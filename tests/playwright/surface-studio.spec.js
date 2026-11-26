import { expect, test } from '@playwright/test';

test.use({ hasTouch:true, isMobile:true, viewport:{width:390,height:844} });

const tapTitle = async (page, action) => {
  await page.waitForFunction(action => {
    const title=window.__game?.title;
    return title?.screen==='main' ? title.menuBounds.has(action) : title?.folderBounds[title.screen]?.has(action);
  }, action);
  const {x,y}=await page.evaluate(action=>{
    const g=window.__game,t=g.title;
    const b=t.screen==='main'?t.menuBounds.get(action):t.folderBounds[t.screen].get(action);
    const r=g.canvas.getBoundingClientRect();
    return {x:r.left+(b.x+b.w/2)*r.width/(g.viewport.width||g.canvas.width),
      y:r.top+(b.y+b.h/2)*r.height/(g.viewport.height||g.canvas.height)};
  },action);
  await page.touchscreen.tap(x,y);
};

test('Graphics opens mobile 3D Car Design, edits a draft, and returns to Graphics', async ({page}) => {
  await page.goto('/index.html?hideFullscreenForTesting');
  await page.waitForFunction(()=>window.__gameReady && window.__game.state!=='loading');
  await page.evaluate(()=>{
    const g=window.__game;
    for (const el of document.querySelectorAll('[role=dialog]')) el.__closeLatestChanges?.();
    g.transitionTo('title');g.title.setScreen('main');g.title.setMainMenuReady(true);
  });
  await tapTitle(page,'graphics');
  await expect.poll(()=>page.evaluate(()=>window.__game.title.screen)).toBe('graphics');
  await tapTitle(page,'surface-studio');
  const frame=page.frameLocator('#surface-studio-frame');
  await expect(frame.locator('html')).toHaveAttribute('data-designer-ready','true');
  await expect(frame.locator('#status')).toHaveAttribute('data-valid','true');
  await expect(frame.locator('#studio-mobile-rail')).toBeVisible();
  await frame.getByRole('button',{name:'Shape',exact:true}).tap();
  await frame.locator('#preset').selectOption('e30');
  const width=frame.locator('#num-width');
  await width.fill('.022');
  await width.press('Tab');
  await expect.poll(()=>frame.locator('body').evaluate(()=>window.designer.getGenome().parameters.width)).toBe(.022);
  await frame.getByRole('button',{name:'View',exact:true}).tap();
  await frame.getByRole('button',{name:'Side',exact:true}).tap();
  await frame.locator('#shading').selectOption('zebra');
  await expect(frame.locator('#status')).toHaveAttribute('data-valid','true');
  await page.setViewportSize({width:844,height:390});
  await expect(frame.locator('#studio-mobile-rail')).toBeVisible();
  await expect.poll(()=>frame.locator('body').evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(844);
  await frame.getByRole('button',{name:'Graphics'}).tap();
  await expect(page.locator('#surface-studio-frame')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>[window.__game.state,window.__game.title.screen])).toEqual(['title','graphics']);
  await tapTitle(page,'surface-studio');
  await expect.poll(()=>frame.locator('body').evaluate(()=>window.designer?.getGenome()?.parameters.width)).toBe(.022);
});
