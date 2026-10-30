// Browser regression: opening the page must work before machine data arrives.
// Run against a preview server with Playwright available on NODE_PATH.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')

async function main() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.setDefaultTimeout(15000)
    const errors = []
    let savedRules = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(() => sessionStorage.setItem('sm_access', 'browser-regression-mocked-token'))
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
      let body = {}
      if (path === '/me') body = { id: 1, email: 'test@example.test', role: 'admin', sites: ['test'] }
      else if (path === '/overview') body = { machines: [], events: [] }
      else if (path === '/gateways' || path.endsWith('/captures')) body = []
      else if (path.endsWith('/customer-rules')) {
        if (route.request().method() === 'PUT') savedRules = route.request().postDataJSON().rules
        body = { rules: savedRules }
      }
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
    await page.getByRole('heading', { name: /Mã lỗi & quy tắc khách hàng/ }).waitFor()
    await page.getByRole('button', { name: 'Lưu quy tắc', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Thêm quy tắc', exact: true }).click()
    await page.getByLabel('Mã lỗi', { exact: true }).fill('E02')
    await page.getByLabel('Tên lỗi', { exact: true }).fill('Test rule')
    if (process.env.RULE_SCREENSHOTS) await page.screenshot({ path: 'exports/rules-editor-desktop.png' })
    await page.getByRole('button', { name: 'Thêm vào danh sách', exact: true }).click()
    await page.getByText('Test rule', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Sửa', exact: true }).click()
    await page.getByLabel('Tên lỗi', { exact: true }).fill('Updated rule')
    await page.getByRole('button', { name: 'Cập nhật quy tắc', exact: true }).click()
    await page.getByRole('button', { name: 'Lưu quy tắc', exact: true }).click()
    await page.getByText('1 quy tắc đã lưu', { exact: true }).waitFor()
    assert.equal(savedRules[0].name, 'Updated rule')
    if (process.env.RULE_SCREENSHOTS) await page.locator('.customer-rules').screenshot({ path: 'exports/rules-card-desktop.png' })
    await page.setViewportSize({ width: 390, height: 844 })
    assert(await page.locator('.customer-rules').evaluate(el => el.scrollWidth <= el.clientWidth + 1))
    if (process.env.RULE_SCREENSHOTS) await page.locator('.customer-rules').screenshot({ path: 'exports/rules-card-mobile.png' })
    await page.getByRole('button', { name: 'Xóa', exact: true }).click()
    await page.getByRole('button', { name: 'Xóa', exact: true }).last().click()
    await page.getByRole('button', { name: 'Lưu quy tắc', exact: true }).click()
    await page.getByText('0 quy tắc đã lưu', { exact: true }).waitFor()
    assert.equal(savedRules.length, 0)
    await page.reload()
    await page.getByText('Phân tích FFT theo khoảng thời gian', { exact: true }).waitFor()
    await page.waitForTimeout(2500)
    assert.equal(await page.getByText('Không thể hiển thị màn hình này', { exact: true }).count(), 0)
    assert.deepEqual(errors, [])
    console.log('PASS: delayed machine data; add/edit/delete/save rules; mobile layout; direct reload')
  } finally {
    await browser.close()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
