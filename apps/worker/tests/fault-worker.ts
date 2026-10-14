import worker, { app } from '../src/index';

type LocalEnv = Parameters<typeof app.fetch>[1];
type Fault =
  | 'invalid-max'
  | 'listing-read-before'
  | 'put-after'
  | 'delete-target-before'
  | 'delete-target-after'
  | 'delete-target-noop'
  | 'delete-backup-before'
  | 'delete-backup-after'
  | 'delete-head-before'
  | 'delete-head-after'
  | 'restore-put-before'
  | 'lock-delete-before'
  | 'lock-delete-after'
  | 'lock-select-before'
  | 'lock-select-after'
  | 'listing-insert-before'
  | 'listing-insert-after'
  | 'listing-select-after-insert'
  | 'batch-before'
  | 'batch-after'
  | 'batch-zero-changes'
  | 'batch-report-success'
  | 'idem-commit-before'
  | 'idem-commit-after'
  | 'operation-state-before'
  | 'operation-state-after'
  | 'delete-compensation-before'
  | 'delete-compensation-after'
  | 'delete-compensation-noop';

export default {
  async fetch(request: Request, env: LocalEnv, ctx: ExecutionContext) {
    if(request.headers.get('x-local-missing-jwt-secret')==='true'){const {JWT_SECRET: _omitted,...withoutSecret}=env;return app.fetch(request,withoutSecret as LocalEnv,ctx);}
    if(request.headers.has('x-local-jwt-secret'))return app.fetch(request,{...env,JWT_SECRET:request.headers.get('x-local-jwt-secret')??''},ctx);
    const fault=request.headers.get('x-local-fault') as Fault|null;
    const jwtExpiry=request.headers.get('x-local-jwt-expiry');
    if(!fault)return app.fetch(request,jwtExpiry?{...env,JWT_EXPIRES_IN:jwtExpiry}:env,ctx);
    if(fault==='invalid-max')return app.fetch(request,{...env,MAX_IMAGE_BYTES:'NaN'},ctx);

    // One injected fault per request keeps each HTTP failure scenario causally isolated.
    let injected=false,listingInsertSeen=false;
    const failBefore=()=>{injected=true;throw Error(`injected ${fault} failure before effect`);};
    const failAfter=()=>{injected=true;throw Error(`injected ${fault} response failure after effect`);};
    const isListingInsert=(query:string)=>/^\s*INSERT\s+INTO\s+listings\b/i.test(query);
    const isListingReadback=(query:string)=>/^\s*SELECT\b[\s\S]*\bFROM\s+listings\s+WHERE\s+id\s*=\s*\?/i.test(query);
    const isOwnerListingRead=(query:string)=>/^\s*SELECT\b[\s\S]*\bFROM\s+listings\s+WHERE\s+owner_id\s*=\s*\?/i.test(query);
    const isLockRelease=(query:string)=>/^\s*DELETE\s+FROM\s+listing_locks\b/i.test(query);
    const isLockReadback=(query:string)=>/^\s*SELECT\s+token\s*,\s*expires_at\s+FROM\s+listing_locks\b/i.test(query);
    const isOperationStateUpdate=(query:string)=>/^\s*UPDATE\s+image_operations\s+SET\s+state\s*=/i.test(query);
    const isIdempotencyCommit=(query:string)=>/^\s*UPDATE\s+idempotency_records\s+SET\s+state\s*=\s*'COMMITTED'/i.test(query);

    const db=new Proxy(env.DB,{get(target,property){
      const value=Reflect.get(target,property,target);
      if(property==='batch')return async(...statements:Parameters<D1Database['batch']>)=>{
        if(!injected&&fault==='batch-before')failBefore();
        if(!injected&&fault==='batch-zero-changes'){
          injected=true;
          const results=await value.apply(target,statements);
          return results.map((result,index)=>index===0?{...result,meta:{...result.meta,changes:0}}:result);
        }
        if(!injected&&fault==='batch-after'){
          injected=true;
          await value.apply(target,statements);
          failAfter();
        }
        if(!injected&&fault==='batch-report-success'){
          injected=true;
          const results=await value.apply(target,statements);
          return results.map(result=>({...result,meta:{...result.meta,changes:1}}));
        }
        return value.apply(target,statements);
      };
      if(property!=='prepare')return typeof value==='function'?value.bind(target):value;
      return (query:string)=>{
        if(isListingInsert(query))listingInsertSeen=true;
        const statement=value.call(target,query);
        const interceptListingInsert=isListingInsert(query);
        const interceptListingReadback=listingInsertSeen&&isListingReadback(query);
        const interceptOwnerListingRead=isOwnerListingRead(query);
        const interceptLockRelease=isLockRelease(query);
        const interceptLockReadback=isLockReadback(query);
        const interceptOperationState=isOperationStateUpdate(query);
        const interceptIdempotencyCommit=isIdempotencyCommit(query);
        return new Proxy(statement,{get(stmt,stmtProperty){
          const stmtValue=Reflect.get(stmt,stmtProperty,stmt);
          if(stmtProperty!=='bind')return typeof stmtValue==='function'?stmtValue.bind(stmt):stmtValue;
          return (...parameters:unknown[])=>{
            const bound=stmtValue.apply(stmt,parameters);
            return new Proxy(bound,{get(boundStatement,boundProperty){
              const boundValue=Reflect.get(boundStatement,boundProperty,boundStatement);
              const isRead=boundProperty==='first'||boundProperty==='all';
              const isWrite=boundProperty==='run';
              if(!isRead&&!isWrite)return typeof boundValue==='function'?boundValue.bind(boundStatement):boundValue;
              return async(...args:unknown[])=>{
                if(!injected&&interceptListingInsert&&isWrite&&fault==='listing-insert-before')failBefore();
                if(!injected&&interceptListingReadback&&boundProperty==='first'&&fault==='listing-select-after-insert')failBefore();
                if(!injected&&interceptOwnerListingRead&&boundProperty==='all'&&fault==='listing-read-before')failBefore();
                if(!injected&&interceptLockRelease&&isWrite&&fault==='lock-delete-before')failBefore();
                if(!injected&&interceptLockReadback&&isRead&&fault==='lock-select-before')failBefore();
                if(!injected&&interceptOperationState&&isWrite&&fault==='operation-state-before')failBefore();
                if(!injected&&interceptIdempotencyCommit&&isWrite&&fault==='idem-commit-before')failBefore();
                if(!injected&&interceptListingInsert&&isWrite&&fault==='listing-insert-after'){
                  injected=true;
                  await boundValue.apply(boundStatement,args);
                  failAfter();
                }
                if(!injected&&interceptLockRelease&&isWrite&&fault==='lock-delete-after'){
                  injected=true;
                  await boundValue.apply(boundStatement,args);
                  failAfter();
                }
                if(!injected&&interceptLockReadback&&isRead&&fault==='lock-select-after'){
                  injected=true;
                  await boundValue.apply(boundStatement,args);
                  failAfter();
                }
                if(!injected&&interceptOperationState&&isWrite&&fault==='operation-state-after'){
                  injected=true;
                  await boundValue.apply(boundStatement,args);
                  failAfter();
                }
                if(!injected&&interceptIdempotencyCommit&&isWrite&&fault==='idem-commit-after'){
                  injected=true;
                  await boundValue.apply(boundStatement,args);
                  failAfter();
                }
                return boundValue.apply(boundStatement,args);
              };
            }}) as D1PreparedStatement;
          };
        }}) as D1PreparedStatement;
      };
    }}) as D1Database;

    const isAddCompensation=async(key:string)=>{
      try{
        const operation=await env.DB.prepare("SELECT kind FROM image_operations WHERE object_key=? AND kind='ADD' ORDER BY created_at DESC LIMIT 1").bind(key).first();
        return !!operation;
      }catch{return false;}
    };
    const bucket=new Proxy(env.IMAGES,{get(target,property){
      const value=Reflect.get(target,property,target);
      if(property==='head')return async(key:string)=>{
        if(!injected&&fault==='delete-head-before'&&key.startsWith('listings/'))failBefore();
        if(!injected&&fault==='delete-head-after'&&key.startsWith('listings/')){injected=true;await value.call(target,key);failAfter();}
        return value.call(target,key);
      };
      if(property==='put')return async(key:string,...args:unknown[])=>{
        if(!injected&&fault==='put-after'&&key.startsWith('listings/')){injected=true;await value.call(target,key,...args);failAfter();}
        if(!injected&&fault==='restore-put-before'&&key.startsWith('listings/'))failBefore();
        return value.call(target,key,...args);
      };
      if(property==='delete')return async(key:string)=>{
        if(!injected&&fault==='delete-target-before'&&key.startsWith('listings/'))failBefore();
        if(!injected&&fault==='delete-target-after'&&key.startsWith('listings/')){injected=true;await value.call(target,key);failAfter();}
        if(!injected&&fault==='delete-target-noop'&&key.startsWith('listings/')){injected=true;return;}
        if(!injected&&key.startsWith('listings/')&&await isAddCompensation(key)&&fault==='delete-compensation-before')failBefore();
        if(!injected&&key.startsWith('listings/')&&await isAddCompensation(key)&&fault==='delete-compensation-after'){injected=true;await value.call(target,key);failAfter();}
        if(!injected&&key.startsWith('listings/')&&await isAddCompensation(key)&&fault==='delete-compensation-noop'){injected=true;return;}
        if(!injected&&fault==='delete-backup-before'&&key.startsWith('compensation/'))failBefore();
        if(!injected&&fault==='delete-backup-after'&&key.startsWith('compensation/')){injected=true;await value.call(target,key);failAfter();}
        return value.call(target,key);
      };
      return typeof value==='function'?value.bind(target):value;
    }}) as R2Bucket;
    return app.fetch(request,{...env,DB:db,IMAGES:bucket},ctx);
  },
  scheduled: worker.scheduled
};
