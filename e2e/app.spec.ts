import { test, expect } from '@playwright/test';
test('login page renders', async ({ page }) => { await page.goto('http://127.0.0.1:4200/discoteca/login'); await expect(page.locator('ion-title')).toContainText('Discoteca'); });
