// Browser regression: opening the page must work before machine data arrives.
// Run against a preview server with Playwright available on NODE_PATH.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => sessionStorage.setItem('sm_access', 'browser-regression-mocked-token'))
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
      let body = {}
      if (path === '/me') body = { id: 1, email: 'test@example.test', role: 'admin', sites: ['test'] }
      else if (path === '/overview') body = { machines: [], events: [] }
      else if (path === '/gateways' || path.endsWith('/captures')) body = []
      else if (path.endsWith('/customer-rules')) body = { rules: [] }
      else if (path.endsWith('/sensor-slots')) body = { slots: [] }
      else if (path === '/machines/pump-tg-01') {
        await new Promise(resolve => setTimeout(resolve, 1800))
        body = { id: 'pump-tg-01', name: 'Regression pump', points: [], rated_speed_rpm: 2950 }
      }
      await route.fulfill({ json: body })
    })
    await page.goto(`${process.argv[2] || 'http://127.0.0.1:4173'}/machines/pump-tg-01/deep-analysis`)
    await page.getByText('Phân tích FFT theo khoảng thời gian', { exact: true }).waitFor()
    await page.waitForTimeout(2500)
    assert.equal(await page.getByText('Không thể hiển thị màn hình này', { exact: true }).count(), 0)
    assert.deepEqual(errors, [])
    await page.getByText('Mã lỗi & quy tắc khách hàng', { exact: true }).click()
    await page.getByRole('button', { name: 'Lưu quy tắc', exact: true }).waitFor()
    await page.reload()
    await page.getByText('Phân tích FFT theo khoảng thời gian', { exact: true }).waitFor()
    await page.waitForTimeout(2500)
    assert.equal(await page.getByText('Không thể hiển thị màn hình này', { exact: true }).count(), 0)
    assert.deepEqual(errors, [])
    console.log('PASS: delayed machine data, rules panel, and direct page reload')
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
