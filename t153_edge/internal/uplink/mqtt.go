// Package uplink sends outbox messages to the server over MQTT/TLS with
// store-and-forward (ADR-05) and receives downlink commands and configuration.
package uplink

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"sync/atomic"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"

	"selink.vn/smartmotor/edge/internal/config"
	"selink.vn/smartmotor/edge/internal/store"
	"selink.vn/smartmotor/edge/internal/version"
)

// Command is a downlink command (spec 5.10 "cmd").
type Command struct {
	CmdID   string          `json:"cmd_id"`
	Type    string          `json:"type"` // capture_now | reload_config | set_sensor_param | reboot | ota_update | ping | upload_logs | learn_alpha
	PointID string          `json:"point_id,omitempty"`
	Profile string          `json:"profile,omitempty"`
	URL     string          `json:"url,omitempty"`
	SHA256  string          `json:"sha256,omitempty"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// Ack is published on cmd/ack.
type Ack struct {
	CmdID  string `json:"cmd_id"`
	Status string `json:"status"` // ok | error | accepted
	Detail string `json:"detail,omitempty"`
	TS     string `json:"ts"`
}

// Client is the MQTT uplink.
type Client struct {
	cfg       *config.Config
	st        *store.Store
	log       *slog.Logger
	prefix    string
	cli       mqtt.Client
	connected atomic.Bool
	cmds      chan Command
	configs   chan []byte
	kick      chan struct{}
	// OnConnect is called after each successful connection (e.g. confirm OTA).
	OnConnect func()
}

// New creates a client (not yet connected).
func New(cfg *config.Config, st *store.Store, log *slog.Logger) (*Client, error) {
	c := &Client{cfg: cfg, st: st, log: log.With("mod", "uplink"), prefix: cfg.TopicPrefix(),
		cmds: make(chan Command, 16), configs: make(chan []byte, 2), kick: make(chan struct{}, 1)}
	broker := cfg.MQTT.URL
	switch {
	case strings.HasPrefix(broker, "mqtts://"):
		broker = "ssl://" + strings.TrimPrefix(broker, "mqtts://")
	case strings.HasPrefix(broker, "mqtt://"):
		broker = "tcp://" + strings.TrimPrefix(broker, "mqtt://")
	}
	pw, err := cfg.MQTTPassword()
	if err != nil {
		return nil, fmt.Errorf("mqtt password: %w", err)
	}
	opts := mqtt.NewClientOptions().
		AddBroker(broker).
		SetClientID("edge-"+cfg.Gateway.ID).
		SetUsername(cfg.MQTT.Username).
		SetPassword(pw).
		SetKeepAlive(60*time.Second).
		SetCleanSession(false).
		SetOrderMatters(false).
		SetAutoReconnect(true).
		SetConnectRetry(true).
		SetConnectRetryInterval(5*time.Second).
		SetMaxReconnectInterval(60*time.Second).
		SetWill(c.prefix+"status", `{"online":false}`, 1, true)
	if strings.HasPrefix(broker, "ssl://") {
		tc, err := tlsConfig(cfg.MQTT)
		if err != nil {
			return nil, err
		}
		opts.SetTLSConfig(tc)
	}
	opts.SetOnConnectHandler(func(cl mqtt.Client) {
		c.connected.Store(true)
		c.log.Info("mqtt connected", "broker", broker)
		status, _ := json.Marshal(map[string]any{"online": true, "version": version.Version, "ts": time.Now().UTC().Format(time.RFC3339Nano)})
		cl.Publish(c.prefix+"status", 1, true, status)
		cl.Subscribe(c.prefix+"cmd", 1, func(_ mqtt.Client, m mqtt.Message) {
			var cmd Command
			if err := json.Unmarshal(m.Payload(), &cmd); err != nil {
				c.log.Warn("bad command", "err", err)
				return
			}
			select {
			case c.cmds <- cmd:
			default:
				c.log.Warn("command queue full, dropping", "cmd_id", cmd.CmdID)
			}
		})
		cl.Subscribe(c.prefix+"config", 1, func(_ mqtt.Client, m mqtt.Message) {
			select {
			case c.configs <- append([]byte(nil), m.Payload()...):
			default:
			}
		})
		if c.OnConnect != nil {
			go c.OnConnect()
		}
		c.signal()
	})
	opts.SetConnectionLostHandler(func(_ mqtt.Client, err error) {
		c.connected.Store(false)
		c.log.Warn("mqtt connection lost", "err", err)
	})
	c.cli = mqtt.NewClient(opts)
	return c, nil
}

func tlsConfig(m config.MQTT) (*tls.Config, error) {
	tc := &tls.Config{MinVersion: tls.VersionTLS12, InsecureSkipVerify: m.InsecureSkip}
	if m.CAFile != "" {
		pem, err := os.ReadFile(m.CAFile)
		if err != nil {
			return nil, err
		}
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(pem) {
			return nil, fmt.Errorf("no certs in %s", m.CAFile)
		}
		tc.RootCAs = pool
	}
	if m.CertFile != "" && m.KeyFile != "" {
		cert, err := tls.LoadX509KeyPair(m.CertFile, m.KeyFile)
		if err != nil {
			return nil, err
		}
		tc.Certificates = []tls.Certificate{cert}
	}
	return tc, nil
}

// Connected reports the connection state.
func (c *Client) Connected() bool { return c.connected.Load() }

// Commands returns the downlink command channel.
func (c *Client) Commands() <-chan Command { return c.cmds }

// Configs returns the downlink configuration channel.
func (c *Client) Configs() <-chan []byte { return c.configs }

// Topic builds a full topic from a suffix.
func (c *Client) Topic(suffix string) string { return c.prefix + suffix }

func (c *Client) signal() {
	select {
	case c.kick <- struct{}{}:
	default:
	}
}

// Enqueue marshals v and stores it in the outbox.
func (c *Client) Enqueue(suffix string, qos byte, prio int, v any) error {
	b, ok := v.([]byte)
	if !ok {
		var err error
		if b, err = json.Marshal(v); err != nil {
			return err
		}
	}
	return c.st.Enqueue(c.prefix+suffix, qos, prio, b)
}

// Ack publishes a command acknowledgment through the outbox.
func (c *Client) Ack(cmdID, status, detail string) {
	_ = c.Enqueue("cmd/ack", 1, store.PrioEvent, Ack{CmdID: cmdID, Status: status, Detail: detail, TS: time.Now().UTC().Format(time.RFC3339Nano)})
}

// Run connects and forwards the outbox until ctx ends.
func (c *Client) Run(ctx context.Context) {
	c.cli.Connect() // with ConnectRetry the token completes once connected
	defer func() {
		if c.cli.IsConnected() {
			c.cli.Publish(c.prefix+"status", 1, true, `{"online":false}`).WaitTimeout(2 * time.Second)
		}
		c.cli.Disconnect(500)
	}()
	tick := time.NewTicker(2 * time.Second)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		case <-c.kick:
		case <-c.st.Notify():
		}
		for c.Connected() && ctx.Err() == nil {
			n, err := c.flush()
			if err != nil {
				c.log.Warn("outbox flush failed", "err", err)
				break
			}
			if n == 0 {
				break
			}
		}
	}
}

// flush publishes one batch; returns number of messages acknowledged.
func (c *Client) flush() (int, error) {
	msgs, err := c.st.Pending(25)
	if err != nil || len(msgs) == 0 {
		return 0, err
	}
	type inflight struct {
		m store.Message
		t mqtt.Token
	}
	var fl []inflight
	for _, m := range msgs {
		fl = append(fl, inflight{m, c.cli.Publish(m.Topic, m.QoS, false, m.Payload)})
	}
	acked := 0
	for _, f := range fl {
		if !f.t.WaitTimeout(20*time.Second) || f.t.Error() != nil {
			_ = c.st.Fail(f.m.ID)
			if f.t.Error() != nil {
				return acked, f.t.Error()
			}
			return acked, fmt.Errorf("publish timeout topic=%s", f.m.Topic)
		}
		if err := c.st.Ack(f.m.ID); err != nil {
			return acked, err
		}
		acked++
	}
	return acked, nil
}
