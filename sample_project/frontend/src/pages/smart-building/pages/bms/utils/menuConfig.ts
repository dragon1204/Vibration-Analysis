import { Fan, Flame, Lightbulb, ShieldCheck, Wifi, Zap } from "lucide-react";
import {  
  LayoutDashboard, 
  Share2, 
  TrendingUp, 
  Bell, 
  FileText, 
  Layout, 
  GitFork, 
  Server, 
  Battery, 
  BatteryCharging 
} from "lucide-react"; 
export const BMSMENU = [
  {
    id: "hvac",
    label: "HVAC",
    icon: Fan,
    children: [
      { id: "floor-plan", label: "Floor Plan" },
      { id: "ahu", label: "AHU" },
      { id: "plant", label: "Plant Equipment" },
      { id: "thermal", label: "Thermal Energy" },
      { id: "meeting", label: "Meeting Room" },
      { id: "schedule", label: "Schedules" },
      { id: "trends", label: "Trends" },
      { id: "occupancy", label: "Occupancy" },
      { id: "advisor", label: "Building Advisor" },
    ],
  },
  {
    id: "power",
    label: "Power",
    icon: Zap,
    children: [
      { id: "power-overview", label: "Power Overview" },
      { id: "transformer", label: "Transformer" },
      { id: "generators", label: "Generators" },
      { id: "ups", label: "UPS Systems" },
    ],
  },
  {
    id: "security",
    label: "Security",
    icon: ShieldCheck,
    children: [
      { id: "security-overview", label: "Security Overview" },
      { id: "access", label: "Access Control" },
      { id: "detection", label: "Intrusion Detection" },
      { id: "alarms", label: "Alarms" },
    ],
  },
  {
    id: "lighting",
    label: "Lighting",
    icon: Lightbulb,
    children: [
      { id: "light-overview", label: "Lighting Overview" },
      { id: "zones", label: "Zones" },
      { id: "schedules", label: "Schedules" },
      { id: "sensors", label: "Sensors" },
    ],
  },
  {
    id: "fire",
    label: "Fire",
    icon: Flame,
    children: [
      { id: "light-overview", label: "Lighting Overview" },
      { id: "zones", label: "Zones" },
      { id: "schedules", label: "Schedules" },
      { id: "sensors", label: "Sensors" },
    ],
  },
  {
    id: "room",
    label: "Connected Room",
    icon: Wifi,
    children: [
      { id: "room-overview", label: "Room Overview" },
      { id: "booking", label: "Booking" },
      { id: "occupancy", label: "Occupancy" },
      { id: "devices", label: "Devices" },
    ],
  },
];

export const EMSMENU = [
  {
    id: "pme",
    label: "PME - Giám sát công suất",
    icon: Zap,
    children: [
      { id: "dashboards", label: "Dashboards", icon: LayoutDashboard },
      { id: "diagrams", label: "Diagrams", icon: Share2 },
      { id: "trends", label: "Trends", icon: TrendingUp },
      { id: "alarms", label: "Alarms", icon: Bell },
      { id: "reports", label: "Reports", icon: FileText },
    ],
  },
  {
    id: "overview",
    label: "Tổng quan",
    icon: Layout,
  },
  {
    id: "electrical-diagram",
    label: "Sơ đồ điện",
    icon: GitFork,
    children: [
      // Bạn có thể thêm các mục con của sơ đồ điện vào đây nếu có
    ],
  },
  {
    id: "server-rack",
    label: "Server Rack",
    icon: Server,
  },
  {
    id: "ups",
    label: "UPS",
    icon: Battery,
  },
  {
    id: "charging-station",
    label: "Trạm sạc",
    icon: BatteryCharging,
  },
];