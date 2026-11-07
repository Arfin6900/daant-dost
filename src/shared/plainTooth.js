import { toothById } from "../data/teeth.js";

// A tooth named the way patients talk: "big back tooth, bottom left".
export const plainTooth = (id) => {
  const t = toothById(id);
  if (!t) return "";
  const kind =
    t.position === 8 && t.dentition === "permanent"
      ? "wisdom tooth"
      : { incisor: "front tooth", canine: "pointed tooth (canine)", premolar: "small back tooth", molar: "big back tooth" }[t.kind];
  return `${t.dentition === "primary" ? "baby " : ""}${kind}, ${t.arch === "upper" ? "top" : "bottom"} ${t.side}`;
};

// Quick areas for people who'd rather not click a tooth. Left and right are
// the patient's own.
export const MOUTH_AREAS = [
  { id: "top_front", label: "Top front", teeth: ["11", "21"] },
  { id: "top_right", label: "Top right, back", teeth: ["16"] },
  { id: "top_left", label: "Top left, back", teeth: ["26"] },
  { id: "bottom_front", label: "Bottom front", teeth: ["31", "41"] },
  { id: "bottom_right", label: "Bottom right, back", teeth: ["46"] },
  { id: "bottom_left", label: "Bottom left, back", teeth: ["36"] },
  { id: "very_back", label: "Right at the very back", teeth: ["38", "48"] },
];

// Baby-teeth equivalents for a child's mouth.
export const CHILD_AREAS = [
  { id: "top_front", label: "Top front", teeth: ["51", "61"] },
  { id: "top_right", label: "Top right, back", teeth: ["55"] },
  { id: "top_left", label: "Top left, back", teeth: ["65"] },
  { id: "bottom_front", label: "Bottom front", teeth: ["71", "81"] },
  { id: "bottom_right", label: "Bottom right, back", teeth: ["85"] },
  { id: "bottom_left", label: "Bottom left, back", teeth: ["75"] },
];
