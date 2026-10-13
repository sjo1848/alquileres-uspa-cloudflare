import worker, { app } from '../src/index';

type LocalEnv = Parameters<typeof app.fetch>[1];
type Fault = 'invalid-max'|'put-after'|'delete-target-before'|'delete-target-after'|'delete-backup-before'|'restore-put-before'|'lock-delete-before'|'lock-delete-after';

export default {
  async fetch(request: Request, env: LocalEnv, ctx: ExecutionContext) {
    const fault=request.headers.get('x-local-fault') as Fault|null;
    if(!fault)return app.fetch(request,env,ctx);
    if(fault==='invalid-max')return app.fetch(request,{...env,MAX_IMAGE_BYTES:'NaN'},ctx);
    let injected=false;
    const db=new Proxy(env.DB,{get(target,property){
      const value=Reflect.get(target,property,target);
      if(property!=='prepare')return typeof value==='function'?value.bind(target):value;
      return (query:string)=>{
        const statement=value.call(target,query);
        if(!/^\s*DELETE\s+FROM\s+listing_locks\b/i.test(query))return statement;
        return new Proxy(statement,{get(stmt,stmtProperty){
          const stmtValue=Reflect.get(stmt,stmtProperty,stmt);
          if(stmtProperty!=='bind')return typeof stmtValue==='function'?stmtValue.bind(stmt):stmtValue;
          return (...parameters:unknown[])=>{
            const bound=stmtValue.apply(stmt,parameters);
            return new Proxy(bound,{get(boundStatement,boundProperty){
              const boundValue=Reflect.get(boundStatement,boundProperty,boundStatement);
              if(boundProperty!=='run')return typeof boundValue==='function'?boundValue.bind(boundStatement):boundValue;
              return async(...runArgs:unknown[])=>{
                if(!injected&&fault==='lock-delete-before'){injected=true;throw Error('injected D1 lock delete failure before effect');}
                if(!injected&&fault==='lock-delete-after'){
                  injected=true;
                  await boundValue.apply(boundStatement,runArgs);
                  throw Error('injected D1 lock delete failure after effect');
                }
                return boundValue.apply(boundStatement,runArgs);
              };
            }}) as D1PreparedStatement;
          };
        }}) as D1PreparedStatement;
      };
    }}) as D1Database;
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
    return app.fetch(request,{...env,DB:db,IMAGES:bucket},ctx);
  },
  scheduled: worker.scheduled
};
