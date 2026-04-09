import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

const STX = 0x02;
const ETX = 0x03;

interface SerialRequestOptions {
  baudRate?: number;
}

interface SerialPortLike {
  readable: ReadableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}

interface SerialNavigatorLike extends Navigator {
  serial?: {
    requestPort(): Promise<SerialPortLike>;
  };
}

@Injectable({ providedIn: 'root' })
export class ScaleService {
  private readonly weightSubject = new Subject<string>();
  private readonly listeningSubject = new BehaviorSubject<boolean>(false);

  private port: SerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private readLoopPromise: Promise<void> | null = null;
  private shouldRead = false;
  private buffer: number[] = [];

  readonly weight$: Observable<string> = this.weightSubject.asObservable();
  readonly listening$: Observable<boolean> = this.listeningSubject.asObservable();

  get isSupported(): boolean {
    if (typeof navigator === 'undefined') {
      return false;
    }

    return !!(navigator as SerialNavigatorLike).serial;
  }

  async startListening(options?: SerialRequestOptions): Promise<void> {
    if (!this.isSupported) {
      throw new Error('El navegador no soporta Web Serial API.');
    }

    if (this.shouldRead && this.readLoopPromise) {
      return;
    }

    const baudRate = options?.baudRate ?? 9600;
    const serialApi = (navigator as SerialNavigatorLike).serial;

    if (!serialApi) {
      throw new Error('No se pudo acceder a la API serial del navegador.');
    }

    try {
      this.port = await serialApi.requestPort();
      await this.port.open({ baudRate });

      if (!this.port.readable) {
        throw new Error('No se pudo abrir el stream de lectura de la báscula.');
      }

      this.reader = this.port.readable.getReader();
      this.shouldRead = true;
      this.buffer = [];
      this.listeningSubject.next(true);

      this.readLoopPromise = this.readLoop();
    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }

  async stopListening(): Promise<void> {
    this.shouldRead = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // ignore cancellation errors
      }
    }

    if (this.readLoopPromise) {
      try {
        await this.readLoopPromise;
      } catch {
        // read loop can reject when stream is interrupted
      }
    }

    await this.cleanup();
  }

  private async readLoop(): Promise<void> {
    if (!this.reader) {
      return;
    }

    let lastWeight: string | null = null;

    try {
      while (this.shouldRead && this.reader) {
        const { value, done } = await this.reader.read();

        if (done) {
          break;
        }

        if (!value || value.length === 0) {
          continue;
        }

        this.buffer.push(...value);

        const extraction = this.extractFrames(this.buffer);
        this.buffer = extraction.rest;

        for (const frame of extraction.frames) {
          const text = this.decodeAscii(frame).trim();
          const weight = this.parseWeight(text);

          if (weight === null) {
            continue;
          }

          if (weight !== lastWeight) {
            this.weightSubject.next(weight);
            lastWeight = weight;
          }
        }
      }
    } finally {
      await this.cleanup();
    }
  }

  private async cleanup(): Promise<void> {
    if (this.reader) {
      try {
        this.reader.releaseLock();
      } catch {
        // ignore
      }
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {
        // ignore close errors
      }
      this.port = null;
    }

    this.readLoopPromise = null;
    this.shouldRead = false;
    this.buffer = [];
    this.listeningSubject.next(false);
  }

  private extractFrames(inputBuffer: number[]): { frames: number[][]; rest: number[] } {
    const frames: number[][] = [];
    let buffer = [...inputBuffer];

    while (true) {
      const stxIndex = buffer.indexOf(STX);
      if (stxIndex !== -1) {
        buffer = buffer.slice(stxIndex + 1);
        const etxIndex = buffer.indexOf(ETX);

        if (etxIndex === -1) {
          return { frames, rest: [STX, ...buffer] };
        }

        frames.push(buffer.slice(0, etxIndex));
        buffer = buffer.slice(etxIndex + 1);
        continue;
      }

      const lfIndex = buffer.indexOf(0x0a);
      if (lfIndex !== -1) {
        frames.push(buffer.slice(0, lfIndex));
        buffer = buffer.slice(lfIndex + 1);
        continue;
      }

      const crIndex = buffer.indexOf(0x0d);
      if (crIndex !== -1) {
        frames.push(buffer.slice(0, crIndex));
        buffer = buffer.slice(crIndex + 1);
        continue;
      }

      return { frames, rest: buffer };
    }
  }

  private parseWeight(frameText: string): string | null {
    const matches = frameText.match(/[-+]?\d+(?:\.\d+)?/g);

    if (!matches || matches.length === 0) {
      return null;
    }

    return matches[matches.length - 1] ?? null;
  }

  private decodeAscii(frame: number[]): string {
    const decoder = new TextDecoder('ascii');
    return decoder.decode(new Uint8Array(frame));
  }
}
