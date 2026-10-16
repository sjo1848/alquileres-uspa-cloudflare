async (page) => {
 for(const pattern of ['**/api/auth/me','**/api/listings'])await page.unroute(pattern);
 const user={id:'synthetic-catalog-owner',email:'preview.owner@example.test',role:'OWNER'};
 let saved={id:'reload-fixture',title:'Original',description:'Sintético',location:'Uspallata',priceAmount:100,currency:'ARS',pricePeriod:'MONTH',rentalDuration:'FLEXIBLE',maxOccupants:1,status:'DRAFT',rejectionReason:null,publicationStatus:'UNPUBLISHED'};
 await page.route('**/api/auth/me',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user)}));
 await page.route('**/api/listings',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([saved])}));
 await page.goto('http://127.0.0.1:5173/owner');
 await page.getByRole('button',{name:'Original Borrador',exact:true}).click();
 saved={...saved,title:'Actualizada en otra pestaña'};
 await page.getByRole('button',{name:'Recargar publicaciones',exact:true}).click();
 await page.getByRole('button',{name:'Actualizada en otra pestaña Borrador',exact:true}).waitFor();
 if(await page.getByLabel('Título',{exact:true}).inputValue()!==saved.title)throw Error('Reload left stale form');
 await page.getByLabel('Título',{exact:true}).fill('Mis cambios sin guardar');
 saved={...saved,title:'Nueva versión guardada'};
 await page.getByRole('button',{name:'Recargar publicaciones',exact:true}).click();
 await page.getByRole('button',{name:'Seguir editando',exact:true}).click();
 if(await page.getByLabel('Título',{exact:true}).inputValue()!=='Mis cambios sin guardar')throw Error('Reload discarded unsaved edits');
 await page.getByRole('button',{name:'Recargar publicaciones',exact:true}).click();
 await page.getByRole('button',{name:'Descartar cambios y recargar',exact:true}).click();
 await page.getByRole('button',{name:'Nueva versión guardada Borrador',exact:true}).waitFor();
 if(await page.getByLabel('Título',{exact:true}).inputValue()!==saved.title)throw Error('Explicit reload did not reconcile form');
 await page.unroute('**/api/auth/me');await page.unroute('**/api/listings');
}
