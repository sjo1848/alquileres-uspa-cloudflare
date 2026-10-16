from pathlib import Path
import json,os,subprocess,urllib.request,urllib.error,datetime
root=Path(__file__).resolve().parents[1];account='30e8fad45f7bc1cd5bddad87e18b1aec';app_id='4c3bd3c6-35ea-4e5e-9257-2435c634cec3';db_id='74a00c52-a63b-45a3-8213-6648378ed5b1';base=f'https://api.cloudflare.com/client/v4/accounts/{account}/'
token=(Path.home()/'.config/alquileres-uspa-cloudflare/api-token').read_text().strip()
report={'authorized_by':'Human explicit temporary test identity and revocation approval,2026-10-16','target_app_id':app_id,'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'mutations':[],'cleanup':{},'probe_ran':False};credential=Path.home()/'.config/alquileres-uspa-cloudflare/access-probe.json';service=None;policy=None;old_hash=None
class APIFailure(Exception):pass
def api(path,data=None,method=None):
 request=urllib.request.Request(base+path,data=json.dumps(data).encode() if data is not None else None,method=method,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
 try:
  with urllib.request.urlopen(request,timeout=25) as response:obj=json.load(response)
 except urllib.error.HTTPError as e:
  report['failed_endpoint']={'method':method or ('POST' if data is not None else 'GET'),'path':path,'status':e.code}
  try:report['failed_endpoint']['errors']=json.loads(e.read()).get('errors')
  except:pass
  raise APIFailure('Specified API endpoint denied or failed') from None
 if not obj.get('success',True):raise APIFailure('API returned unsuccessful result')
 return obj.get('result')
def policies():return api('access/apps/'+app_id+'/policies')
def signature(rows):return sorted([{k:x.get(k) for k in ['id','name','decision','include','exclude','require','precedence']} for x in rows],key=lambda x:x['id'])
try:
 app=api('access/apps/'+app_id)
 assert app['destinations']==[{'type':'preview_worker','worker_id':'c71023df4bfa4518baeb12dfa3c67826'}], 'Wrong target'
 before=signature(policies());assert len(before)==1 and before[0]['decision']=='allow','Unexpected original policies'
 service=api('access/service_tokens',{'name':'Alquileres temporary synthetic CPU probe','duration':'15m'})
 report['mutations'].append('Created15m temporary service token');report['temporary_service_token_id']=service['id']
 fd=os.open(credential,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:json.dump({'client_id':service['client_id'],'client_secret':service['client_secret']},f)
 policy=api('access/apps/'+app_id+'/policies',{'name':'Temporary synthetic CPU probe','decision':'non_identity','include':[{'service_token':{'token_id':service['id']}}],'precedence':2})
 report['temporary_policy_id']=policy['id'];report['mutations'].append('Added Service Auth policy only to dedicated Preview')
 q=api('d1/database/'+db_id+'/query',{'sql':"SELECT password_hash FROM users WHERE id='synthetic-catalog-owner' AND email='preview.owner@example.test'"})
 old_hash=q[0]['results'][0]['password_hash']
 api('d1/database/'+db_id+'/query',{'sql':"UPDATE users SET password_hash=? WHERE id='synthetic-catalog-owner' AND email='preview.owner@example.test'",'params':['$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS']})
 report['mutations'].append('Temporarily seeded existing synthetic owner cost12 hash')
 r=subprocess.run(['python3',str(root/'scripts/preview-login-probe.py'),'--access-credential-file',str(credential),'--output',str(root/'.orchestration/evidence/CF-AU-OWNER-REMOTE-LOGIN.json')],cwd=root)
 report['probe_ran']=True;report['probe_exit']=r.returncode
except Exception as e:
 report['failure']=str(e) if isinstance(e,APIFailure) else type(e).__name__
finally:
 if policy:
  try:api('access/apps/'+app_id+'/policies/'+policy['id'],method='DELETE');report['cleanup']['temporary_policy_deleted']=True
  except Exception:report['cleanup']['temporary_policy_deleted']=False
 if service:
  # Cloudflare refuses token deletion while any policy still references it.
  try:api('access/service_tokens/'+service['id'],method='DELETE');report['cleanup']['service_token_revoked']=True
  except Exception:report['cleanup']['service_token_revoked']=False
 if old_hash is not None:
  try:api('d1/database/'+db_id+'/query',{'sql':"UPDATE users SET password_hash=? WHERE id='synthetic-catalog-owner' AND email='preview.owner@example.test'",'params':[old_hash]});report['cleanup']['synthetic_hash_restored']=True
  except Exception:report['cleanup']['synthetic_hash_restored']=False
 if credential.exists():credential.unlink()
 try:report['cleanup']['original_policies_unchanged']=signature(policies())==before
 except Exception:report['cleanup']['original_policies_unchanged']=False
 p=root/'.orchestration/evidence/CF-AU-OWNER-TEMPORARY-ACCESS.json';p.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
 if any(v is False for v in report['cleanup'].values()):raise SystemExit('Cleanup verification failure; immediate repair required')
