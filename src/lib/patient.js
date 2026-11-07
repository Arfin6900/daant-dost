import { api } from "./api";
import { getStudent } from "./student";

// The patient's own data. No accounts: the random id this browser keeps.
export const patientId = () => getStudent().id;

export const loadProfile = () => api(`/patient/profile?pid=${encodeURIComponent(patientId())}`);
export const saveProfile = (profile) => api("/patient/profile", { method: "PUT", body: { pid: patientId(), profile } });
export const loadCases = () => api(`/patient/cases?pid=${encodeURIComponent(patientId())}`);
export const loadCase = (id) => api(`/patient/cases/${id}?pid=${encodeURIComponent(patientId())}`);
export const sendCare = (id, message) => api(`/patient/cases/${id}/chat`, { method: "POST", body: { pid: patientId(), message } });
export const resolve = (id, whatHelped, note) =>
  api(`/patient/cases/${id}/resolve`, { method: "POST", body: { pid: patientId(), whatHelped, note } });

export const HISTORY_FIELDS = [
  {
    id: "allergies",
    label: "Allergies",
    help: "Medicines or things you react to.",
    placeholder: "e.g. Penicillin",
    ideas: ["Penicillin", "Ibuprofen", "Aspirin", "Latex", "Local anaesthetic", "Chlorhexidine"],
  },
  {
    id: "medicines",
    label: "Medicines you take",
    help: "Anything you take regularly, including blood thinners.",
    placeholder: "e.g. Metformin",
    ideas: ["Blood thinner (e.g. Warfarin)", "Aspirin daily", "Metformin", "Blood pressure tablets", "Inhaler"],
  },
  {
    id: "conditions",
    label: "Health conditions",
    help: "Conditions a dentist should know about.",
    placeholder: "e.g. Diabetes",
    ideas: ["Diabetes", "Asthma", "Heart condition", "High blood pressure", "Pregnant", "Stomach ulcer", "Kidney disease"],
  },
  {
    id: "treatments",
    label: "Past dental treatments",
    help: "What's been done before, and roughly when.",
    placeholder: "e.g. Root canal, bottom left, 2022",
    ideas: ["Filling", "Root canal", "Crown", "Tooth taken out", "Braces", "Implant", "Scale and polish"],
  },
];
