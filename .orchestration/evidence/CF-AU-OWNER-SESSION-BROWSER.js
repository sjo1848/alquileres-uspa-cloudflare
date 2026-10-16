async (page) => {
 await page.unroute('**/api/auth/me');
 const base='http://127.0.0.1:5173';
 const user={id:'synthetic-catalog-owner',email:'preview.owner@example.test',role:'OWNER'};
 await page.route('**/api/auth/me',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user)}));
 for(const path of ['/','/listings/synthetic-casa-rio']){
  await page.goto(base+path);
  await page.getByRole('link',{name:'Mis publicaciones'}).waitFor();
  await page.getByRole('button',{name:'Cerrar sesión'}).waitFor();
 }
 await page.unroute('**/api/auth/me');
 let release;const hold=new Promise(resolve=>release=resolve);
 await page.route('**/api/auth/me',async route=>{await hold;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user)});});
 await page.goto(base+'/');
 await page.getByRole('heading',{name:'Encontrá tu próximo alquiler'}).waitFor({timeout:4000}).catch(async()=>{
  await page.getByRole('heading',{name:'Casa junto al arroyo'}).waitFor({timeout:4000});
 });
 // Navigate while auth is still pending; the protected guard must await the same restore.
 await page.getByRole('link',{name:'Ingresar como propietario'}).click({noWaitAfter:true});
 release();
 await page.waitForURL(base+'/owner');
 await page.getByRole('heading',{name:'Mis publicaciones'}).waitFor();
 await page.unroute('**/api/auth/me');
 await page.route('**/api/auth/me',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'unavailable'})}));
 await page.goto(base+'/');
 await page.getByRole('heading',{name:'Casa junto al arroyo'}).waitFor();
 await page.unroute('**/api/auth/me');
 console.log('PASS session header on public catalog/detail; public render with pending/failed auth; pending restore awaited on protected navigation. Auth responses stubbed; catalog/backend real local.');
}
