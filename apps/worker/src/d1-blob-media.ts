export const D1_IMAGE_MAX_BYTES = 1_800_000;
export const D1_IMAGE_MAX_COUNT = 20;
export const D1_MEDIA_QUOTA_BYTES = 250_000_000;
export const D1_IMAGE_MAX_PIXELS = 640 * 480;

export type SupportedImageType = 'image/jpeg' | 'image/png' | 'image/webp';

import decodeJpeg, { init as initJpegDecoder } from '@jsquash/jpeg/decode';
import JPEG_DECODER_WASM from '@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm';
import decodePng, { init as initPngDecoder } from '@jsquash/png/decode';
import PNG_DECODER_WASM from '@jsquash/png/codec/pkg/squoosh_png_bg.wasm';
import decodeWebp, { init as initWebpDecoder } from '@jsquash/webp/decode';
import WEBP_DECODER_WASM from '@jsquash/webp/codec/dec/webp_dec.wasm';

type DecodedImage = { width: number; height: number; data: ArrayBufferView };
let jpegReady: Promise<unknown> | undefined;
let pngReady: Promise<unknown> | undefined;
let webpReady: Promise<unknown> | undefined;
let jpegDecoderWarnings = 0;
const initJpegWithDiagnostics = initJpegDecoder as unknown as (
  module: WebAssembly.Module,
  options: { printErr: (message: string) => void },
) => Promise<unknown>;

function imageDimensions(bytes:Uint8Array,type:SupportedImageType):[number,number]|null{
  if(type==='image/png'){
    const read=(offset:number)=>bytes[offset]*0x1000000+bytes[offset+1]*0x10000+bytes[offset+2]*0x100+bytes[offset+3];
    return [read(16),read(20)];
  }
  if(type==='image/jpeg'){
    let offset=2;
    while(offset+4<bytes.length){
      if(bytes[offset]!==0xff)return null;
      while(bytes[offset]===0xff)offset++;
      const marker=bytes[offset++];
      if(marker===0xd9||marker===0xda)break;
      if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
      const length=(bytes[offset]<<8)|bytes[offset+1];
      if(length<2||offset+length>bytes.length)return null;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return [(bytes[offset+5]<<8)|bytes[offset+6],(bytes[offset+3]<<8)|bytes[offset+4]];
      offset+=length;
    }
    return null;
  }
  const chunk=String.fromCharCode(...bytes.slice(12,16));
  if(chunk==='VP8X'&&bytes.length>=30){
    const width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);return [width,height];
  }
  if(chunk==='VP8 '&&bytes.length>=30&&bytes[23]===0x9d&&bytes[24]===0x01&&bytes[25]===0x2a){
    return [((bytes[27]&0x3f)<<8)|bytes[26],((bytes[29]&0x3f)<<8)|bytes[28]];
  }
  if(chunk==='VP8L'&&bytes.length>=25&&bytes[20]===0x2f){
    const width=1+bytes[21]+((bytes[22]&0x3f)<<8),height=1+((bytes[22]>>6)&3)+(bytes[23]<<2)+((bytes[24]&0x0f)<<10);return [width,height];
  }
  return null;
}
function dimensionsSafe(dimensions:[number,number]|null){return !!dimensions&&dimensions[0]>0&&dimensions[1]>0&&dimensions[0]<=12000&&dimensions[1]<=12000&&dimensions[0]*dimensions[1]<=D1_IMAGE_MAX_PIXELS;}

function imageEnvelopeIsValid(bytes: Uint8Array, declaredType: string): declaredType is SupportedImageType {
  if (bytes.length < 16 || bytes.length > D1_IMAGE_MAX_BYTES) return false;
  if (declaredType === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8
      && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9
      && dimensionsSafe(imageDimensions(bytes,declaredType));
  }
  if (declaredType === 'image/png') {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    return signature.every((value, index) => bytes[index] === value)
      && bytes[8] === 0 && bytes[9] === 0 && bytes[10] === 0 && bytes[11] === 13
      && String.fromCharCode(...bytes.slice(12, 16)) === 'IHDR'
      && String.fromCharCode(...bytes.slice(-8, -4)) === 'IEND'
      && dimensionsSafe(imageDimensions(bytes,declaredType));
  }
  if (declaredType === 'image/webp') {
    const riffSize = bytes[4] + (bytes[5] << 8) + (bytes[6] << 16) + (bytes[7] << 24);
    return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
      && riffSize >= 12 && riffSize + 8 === bytes.length
      && dimensionsSafe(imageDimensions(bytes,declaredType));
  }
  return false;
}

export async function validateImageBytes(bytes: Uint8Array, declaredType: string): Promise<boolean> {
  if (!imageEnvelopeIsValid(bytes, declaredType)) return false;
  const dimensions = imageDimensions(bytes, declaredType);
  if (!dimensionsSafe(dimensions) || !dimensions) return false;
  const input = bytes.slice().buffer as ArrayBuffer;
  try {
    let decoded: DecodedImage;
    if (declaredType === 'image/jpeg') {
      jpegReady ??= initJpegWithDiagnostics(JPEG_DECODER_WASM, { printErr: () => { jpegDecoderWarnings++; } });
      await jpegReady;
      const warningsBeforeDecode = jpegDecoderWarnings;
      decoded = await decodeJpeg(input) as DecodedImage;
      if (jpegDecoderWarnings !== warningsBeforeDecode) return false;
    } else if (declaredType === 'image/png') {
      pngReady ??= initPngDecoder(PNG_DECODER_WASM);
      await pngReady;
      decoded = await decodePng(input) as DecodedImage;
    } else {
      webpReady ??= initWebpDecoder(WEBP_DECODER_WASM);
      await webpReady;
      decoded = await decodeWebp(input) as DecodedImage;
    }
    return decoded.width === dimensions[0]
      && decoded.height === dimensions[1]
      && decoded.data.byteLength === decoded.width * decoded.height * 4;
  } catch {
    return false;
  }
}

export function d1BlobBytes(value: unknown): Uint8Array | null {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value) && value.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) return Uint8Array.from(value);
  return null;
}

export async function readBoundedBody(request: Request): Promise<Uint8Array | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > D1_IMAGE_MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export function cleanImageName(raw: string | undefined): string | null {
  if (!raw || raw.length > 1500) return null;
  let name: string;
  try { name = decodeURIComponent(raw).normalize('NFC'); } catch { return null; }
  if (!name || [...name].length > 120 || name.startsWith('.')
    || /[\\/\u0000-\u001f\u007f]/u.test(name)) return null;
  return name;
}
