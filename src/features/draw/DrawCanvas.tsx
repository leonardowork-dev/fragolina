import React from "react";

import DrawCanvasImpl, { type DrawCanvasProps } from "./DrawCanvasImpl";

/** Nativo: Skia è già pronto. Sul web esiste DrawCanvas.web.tsx, che carica CanvasKit (wasm) prima. */
export type { Stroke } from "./DrawCanvasImpl";
export function DrawCanvas(props: DrawCanvasProps) {
  return <DrawCanvasImpl {...props} />;
}
