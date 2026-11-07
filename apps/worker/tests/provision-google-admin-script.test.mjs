import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { buildGoogleAdminProvisionSql, verifyGoogleAdminProvisioningToken } from '../scripts/provision-google-admin.mjs';

const clientId='google-local-test-client.apps.googleusercontent.com';
const now=()=>Math.floor(Date.now()/1000);
async function signer(){
  const pair=await generateKeyPair('RS256',{modulusLength:2048});
  const jwk={...await exportJWK(pair.publicKey),kid:'provisioning-test-key',alg:'RS256',use:'sig'};
  return {privateKey:pair.privateKey,jwks:createLocalJWKSet({keys:[jwk]})};
}
async function token(privateKey,overrides={}){
  return new SignJWT({iss:'https://accounts.google.com',aud:clientId,sub:'google-sub-controlled-admin',email:'admin@example.test',email_verified:true,nonce:'a-long-single-use-challenge',iat:now(),exp:now()+120,...overrides})
    .setProtectedHeader({alg:'RS256',kid:'provisioning-test-key'}).sign(privateKey);
}

test('Google ADMIN provisioning accepts only a fresh verified ID token for the configured audience',async()=>{
  const {privateKey,jwks}=await signer();
  const verified=await verifyGoogleAdminProvisioningToken(await token(privateKey),clientId,jwks);
  assert.deepEqual(verified,{subject:'google-sub-controlled-admin'});
});

test('Google ADMIN provisioning rejects forged, wrong issuer/audience, expired, unverified and nonce-less tokens',async()=>{
  const trusted=await signer(),attacker=await signer();
  await assert.rejects(verifyGoogleAdminProvisioningToken(await token(attacker.privateKey),clientId,trusted.jwks));
  for(const invalid of [
    {iss:'https://attacker.example'},
    {aud:'another-client.apps.googleusercontent.com'},
    {exp:now()-30,iat:now()-120},
    {email_verified:false},
    {nonce:undefined},
    {sub:'bad subject with spaces'},
    {aud:[clientId,'another-client.apps.googleusercontent.com'],azp:'another-client.apps.googleusercontent.com'},
  ]){
    await assert.rejects(verifyGoogleAdminProvisioningToken(await token(trusted.privateKey,invalid),clientId,trusted.jwks));
  }
  await assert.rejects(verifyGoogleAdminProvisioningToken('x'.repeat(16_385),clientId,trusted.jwks));
});

test('provisioning SQL is exact-sub, role-constrained and rejects unsafe parameters',()=>{
  const sql=buildGoogleAdminProvisionSql('google-sub-exact-123','admin-account-1','local-operator:ticket-7');
  assert.match(sql,/INSERT INTO google_admin_identities\(subject,user_id,provisioned_at,provisioned_by\)/);
  assert.match(sql,/WHERE u\.id='admin-account-1' AND u\.role='ADMIN'/);
  assert.match(sql,/g\.subject='google-sub-exact-123'/);
  assert.match(sql,/NOT EXISTS\(SELECT 1 FROM google_admin_identities/);
  assert.doesNotMatch(sql,/email|GOOGLE_CLIENT_ID/i);
  assert.throws(()=>buildGoogleAdminProvisionSql('x','admin\' OR 1=1','operator'));
  assert.throws(()=>buildGoogleAdminProvisionSql('x','missing-admin','operator; DROP TABLE users'));
});
