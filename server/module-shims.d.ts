declare module "resend" {
  export class Resend {
    constructor(apiKey: string);
    emails: {
      send(payload: {
        from: string;
        to: string[];
        subject: string;
        html?: string;
        text?: string;
      }): Promise<{ data?: { id?: string }; error?: { message?: string } }>;
    };
  }
}

declare module "jszip" {
  export interface JSZipObject {
    dir: boolean;
    async(type: "nodebuffer"): Promise<Buffer>;
    _data?: { compressedSize?: number };
  }

  export default class JSZip {
    files: Record<string, JSZipObject>;
    static loadAsync(data: Buffer | ArrayBuffer | Uint8Array): Promise<JSZip>;
  }
}
