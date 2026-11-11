import { WithSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import React from "react";
import { View } from "react-native";

import type { DrawCanvasProps } from "./DrawCanvasImpl";

/** Web (anteprima nel browser): carica CanvasKit da /canvaskit.wasm (cartella public/) e poi la tela vera. */
export type { Stroke } from "./DrawCanvasImpl";
export function DrawCanvas(props: DrawCanvasProps) {
  return (
    <WithSkiaWeb
      opts={{ locateFile: (file: string) => `/${file}` }}
      getComponent={() => import("./DrawCanvasImpl")}
      componentProps={props}
      fallback={<View style={{ width: props.width, height: props.height }} />}
    />
  );
}
