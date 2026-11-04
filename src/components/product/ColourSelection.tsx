"use client";

import { createContext, useContext, useState } from "react";

/**
 * The colour chosen on a product page, shared by the colour buttons (AddToCart) and the photos
 * (ProductGallery): picking a colour shows its photo, and clicking a colour's photo picks that colour.
 */
type ColourState = { colour: string | null; setColour: (c: string | null) => void };

const ColourContext = createContext<ColourState | null>(null);

export function ColourSelectionProvider({ initial, children }: { initial: string | null; children: React.ReactNode }) {
  const [colour, setColour] = useState<string | null>(initial);
  return <ColourContext.Provider value={{ colour, setColour }}>{children}</ColourContext.Provider>;
}

/** null outside a product page (the colour is then kept by the component itself). */
export const useColourSelection = () => useContext(ColourContext);
