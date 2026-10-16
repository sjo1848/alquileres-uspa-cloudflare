async (page) => {
 await page.unroute('**/api/auth/me');
 await page.route('**/api/auth/me',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.route('**/api/auth/config',r=>r.fulfill({status:200,contentType:'application/json',body:'{"strategy":"ACCESS_PREVIEW"}'}));
 await page.route('**/api/auth/preview-session',r=>r.fulfill({status:401,contentType:'application/json',body:'{}'}));
 await page.goto('http://127.0.0.1:5173/login');
 await page.getByRole('button',{name:'Ingresar como propietario',exact:true}).waitFor();
 if(await page.getByLabel('Contraseña',{exact:true}).count())throw Error('Unexpected password prompt in Access mode');
 await page.getByRole('button',{name:'Ingresar como propietario',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'No pudimos verificar tu acceso'}).waitFor();
 await page.unroute('**/api/auth/preview-session');
 await page.route('**/api/auth/preview-session',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:{id:'synthetic-catalog-owner',email:'preview.owner@example.test',role:'OWNER'}})}));
 await page.route('**/api/listings',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 await page.getByRole('button',{name:'Ingresar como propietario',exact:true}).click();
 await page.waitForURL('http://127.0.0.1:5173/owner');
 await page.getByRole('heading',{name:'Mis publicaciones'}).waitFor();
 await page.unroute('**/api/auth/config');
 await page.route('**/api/auth/config',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
 await page.goto('http://127.0.0.1:5173/login');
 await page.getByRole('button',{name:'Reintentar',exact:true}).waitFor();
 if(await page.getByLabel('Contraseña',{exact:true}).count())throw Error('Config failure fell back to password');
 await page.unroute('**/api/auth/me');await page.unroute('**/api/auth/config');await page.unroute('**/api/auth/preview-session');await page.unroute('**/api/listings');
}
