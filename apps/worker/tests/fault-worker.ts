import worker, { app } from '../src/index';

type LocalEnv = Parameters<typeof app.fetch>[1];
type Fault = 'invalid-max'|'put-after'|'delete-target-before'|'delete-target-after'|'delete-backup-before'|'restore-put-before';

export default {
  async fetch(request: Request, env: LocalEnv, ctx: ExecutionContext) {
    const fault=request.headers.get('x-local-fault') as Fault|null;
    if(!fault)return app.fetch(request,env,ctx);
    if(fault==='invalid-max')return app.fetch(request,{...env,MAX_IMAGE_BYTES:'NaN'},ctx);
    let injected=false;
    const bucket=new Proxy(env.IMAGES,{get(target,property){
      const value=Reflect.get(target,property,target);
      if(property==='put')return async(key:string,...args:unknown[])=>{
        if(!injected&&fault==='put-after'&&key.startsWith('listings/')){injected=true;await value.call(target,key,...args);throw Error('injected R2 put response failure after write');}
        if(!injected&&fault==='restore-put-before'&&key.startsWith('listings/')){injected=true;throw Error('injected R2 restore failure before write');}
        return value.call(target,key,...args);
      };
      if(property==='delete')return async(key:string)=>{
        if(!injected&&fault==='delete-target-before'&&key.startsWith('listings/')){injected=true;throw Error('injected R2 target delete failure before delete');}
        if(!injected&&fault==='delete-target-after'&&key.startsWith('listings/')){injected=true;await value.call(target,key);throw Error('injected R2 target delete response failure after delete');}
        if(!injected&&fault==='delete-backup-before'&&key.startsWith('compensation/')){injected=true;throw Error('injected R2 backup cleanup failure before delete');}
        return value.call(target,key);
      };
      return typeof value==='function'?value.bind(target):value;
    }}) as R2Bucket;
    return app.fetch(request,{...env,IMAGES:bucket},ctx);
  },
  scheduled: worker.scheduled
};
