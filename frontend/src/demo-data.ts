import type { AuditSummary } from "./api";

export const DEMO_AUDIT_ID = "demo";
export const DEMO_REPLAY_INTERVAL_MS = 2500; // 2.5s per call — readable pace for live demo

const results: AuditSummary["results"] = [
  {
    npi: "1234567890",
    phone: "212-555-0101",
    status: "ghost",
    ghost_reason: "disconnected",
    provider_name: "Dr. Sarah Chen, LCSW",
    specialty: "Anxiety, Trauma",
    transcript:
      "Agent: Hi, I'm calling to verify if Dr. Sarah Chen accepts Aetna insurance and is accepting new patients for anxiety and trauma therapy.\n[Automated message: The number you have dialed has been disconnected or is no longer in service.]\nAgent: Logging result — disconnected number.",
    summary: "Number disconnected. Provider unreachable.",
    verified_at: "2026-05-02T10:01:00Z",
  },
  {
    npi: "1234567891",
    phone: "212-555-0102",
    status: "ghost",
    ghost_reason: "wrong_network",
    provider_name: "Dr. Marcus Webb, PhD",
    specialty: "CBT, Depression",
    transcript:
      "Agent: Hi, I'm calling to verify whether Dr. Webb accepts Aetna insurance for outpatient therapy.\nReceptionist: Dr. Webb dropped Aetna back in 2023. He's cash-pay only now.\nAgent: Is he planning to rejoin any networks?\nReceptionist: No, I don't believe so.",
    summary: "No longer in Aetna network since 2023.",
    verified_at: "2026-05-02T10:02:30Z",
  },
  {
    npi: "1234567892",
    phone: "212-555-0103",
    status: "ghost",
    ghost_reason: "not_accepting_patients",
    provider_name: "East Side Wellness Center",
    specialty: "General Therapy",
    transcript:
      "Agent: Good afternoon. I'm calling to confirm if you're accepting new Aetna patients for anxiety and trauma therapy.\nReceptionist: We're completely full. The waitlist has been closed since February — we don't know when we'll reopen it.\nAgent: Can you give any estimate on timeline?\nReceptionist: Honestly, no. I'd suggest looking elsewhere.",
    summary: "Closed waitlist since February, no timeline to reopen.",
    verified_at: "2026-05-02T10:04:00Z",
  },
  {
    npi: "1234567893",
    phone: "212-555-0104",
    status: "real",
    ghost_reason: null,
    provider_name: "Dr. Linda Okafor, LMFT",
    specialty: "Trauma-Informed CBT",
    transcript:
      "Agent: Hi, I'm calling to verify if Dr. Okafor is accepting new Aetna patients for anxiety and trauma therapy.\nReceptionist: Yes! Dr. Okafor is in-network with Aetna and we do have availability. She specializes in trauma-informed CBT.\nAgent: Can you confirm she's currently accepting new patients?\nReceptionist: Absolutely — openings as early as next week.",
    summary: "Confirmed in-network, accepting new patients. Openings next week.",
    verified_at: "2026-05-02T10:05:30Z",
  },
  {
    npi: "1234567894",
    phone: "212-555-0105",
    status: "ghost",
    ghost_reason: "wrong_provider",
    provider_name: "Dr. James Ostrowski, PsyD",
    specialty: "Behavioral Health",
    transcript:
      "Agent: Hi, I'm trying to reach Dr. James Ostrowski at Midtown Behavioral Health.\nReceptionist: Dr. Ostrowski hasn't practiced here in over two years. We don't know where he relocated.\nAgent: Is there another Aetna-network therapist at this location?\nReceptionist: We don't have any Aetna providers on staff.",
    summary: "Provider left practice 2+ years ago. Location has no Aetna coverage.",
    verified_at: "2026-05-02T10:07:00Z",
  },
  {
    npi: "1234567895",
    phone: "212-555-0106",
    status: "ghost",
    ghost_reason: "no_behavioral_health",
    provider_name: "Dr. Patricia Gonzalez, MD",
    specialty: "Listed: Behavioral Health",
    transcript:
      "Agent: I'm calling to confirm if Dr. Gonzalez provides behavioral health services and accepts Aetna for therapy.\nReceptionist: Dr. Gonzalez is an orthopedic surgeon. We don't offer any mental health services here.\nAgent: She's listed in Aetna's behavioral health directory — is that an error?\nReceptionist: That has to be a mistake. This is a surgical practice.",
    summary: "Orthopedic surgeon, no behavioral health services. Directory listing is erroneous.",
    verified_at: "2026-05-02T10:08:30Z",
  },
  {
    npi: "1234567896",
    phone: "212-555-0107",
    status: "ghost",
    ghost_reason: "retired",
    provider_name: "Dr. Kevin Park, LCSW",
    specialty: "Anxiety, PTSD",
    transcript:
      "Agent: Good morning. I'm verifying whether Dr. Park is currently seeing patients and accepting Aetna for mental health therapy.\nReceptionist: Dr. Park retired in early 2024. This line is forwarded to billing only.\nAgent: Is there another provider at this location?\nReceptionist: The practice is closed. We're only handling final billing.",
    summary: "Retired 2024. Practice closed.",
    verified_at: "2026-05-02T10:10:00Z",
  },
  {
    npi: "1234567897",
    phone: "718-555-0108",
    status: "real",
    ghost_reason: null,
    provider_name: "Brooklyn Mind Collective",
    specialty: "Anxiety, Trauma / PTSD",
    transcript:
      "Agent: Hi, calling to confirm whether Brooklyn Mind Collective is accepting new Aetna patients for anxiety and trauma-focused therapy.\nReceptionist: Yes, we are! We have three therapists in-network with Aetna who specialize in anxiety and PTSD.\nAgent: Are they currently taking new patients?\nReceptionist: Two of them are — we can get someone in within two weeks.",
    summary: "Confirmed in-network. 2 of 3 therapists accepting. Available within 2 weeks.",
    verified_at: "2026-05-02T10:11:30Z",
  },
];

export const DEMO_SUMMARY: AuditSummary = {
  audit_id: DEMO_AUDIT_ID,
  status: "completed",
  carrier: "Aetna",
  zip_code: "10001",
  care_needs: ["Anxiety", "Trauma / PTSD"],
  providers_total: 8,
  calls_completed: 8,
  ghost_count: 6,
  real_count: 2,
  voicemail_count: 0,
  other_count: 0,
  ghost_rate: 0.75,
  voicemail_rate: 0,
  complaint_eligible: true,
  share_path: "/results/demo",
  voice_mode: "pipecat",
  loop_agent_note: null,
  top_providers: results.filter((r) => r.status === "real"),
  results,
};
