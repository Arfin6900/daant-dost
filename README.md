Daant Dost
Learn dentistry on a living 3D mouth.

The AI friend that knows where it hurts — for patients, dental students, teachers and clinics.

Live Demo Deployed on Vercel 3D by Blender Built at a Hackathon

Live Demo · Features · How it works · Getting started · Roadmap

</div>
🦷 What is Daant Dost?

Daant Dost ("tooth friend" in Urdu) is an AI-powered dental platform built around one idea: a living, interactive 3D mouth.

Patients tap where it hurts on a 3D jaw, answer a few simple questions in their own language, and find out whether home care is enough, a dentist visit is needed soon, or they should go to emergency now.
Dental students practise on AI patients before they meet real ones and get marked like an OSCE.
Teachers turn a one-line patient description into a full, marked case and see how the class is doing.

"Khud theek ho jayega." ("It'll get better on its own.") Most of us say this about tooth and jaw pain. We take painkillers, wait, and see a dentist only when a small problem has become a big bill. Daant Dost gets people to the right help at the right time.

✨ Features
🧑 For patients: understand your pain
	
3D pain map	Rotate, zoom and tap the exact spot on a 3D jaw model, with no medical words needed.
AI questions in your language	Short, simple follow-ups (Since when? What kind of pain? Hot/cold sensitivity? Swelling?).
Likely source	Suggests whether the pain most likely comes from a muscle, joint (TMJ), tooth or bone.
Clear next step	🟢 Home care is enough · 🟠 See a dentist soon · 🔴 Go to emergency now
Care tips	Simple, safe self-care guidance while you wait.
Dentist report	A clean, structured summary (location, timeline, intensity, likely source, red flags) to show your dentist.
🎓 For dental students: practise before real patients
AI patient + OSCE-style marking: take a history, examine, diagnose, and get scored on a rubric.
AI tutor on the 3D mouth: ask a question and the answer is highlighted in 3D.
3D drills: tooth numbering and dental anatomy, in short daily rounds.
3D explorer: freely explore the mouth, teeth and jaw.
👩‍🏫 For teachers: set cases in seconds
Write a case with AI: describe a patient in one line, and AI writes a full case with a marking scheme.
Same marking for everyone: students play the case with the same scheme, so scores are fair and comparable.
Teach live: put the 3D mouth on the classroom screen and rotate, zoom and highlight.
🏥 For clinics (coming soon)
Pre-visit patient reports in a dentist inbox
Urgency-based booking (red-flag cases first)
Aftercare follow-ups in the patient's language
3D patient explainer for treatment conversations
🔄 How it works
 ┌──────────────┐    ┌───────────────┐    ┌──────────────┐    ┌──────────────────┐
 │  1. Mark     │ →  │  2. Answer    │ →  │  3. Triage   │ →  │  4. Guide        │
 │  pain on the │    │  simple AI    │    │  likely      │    │  care tips +     │
 │  3D jaw      │    │  questions    │    │  source +    │    │  dentist report  │
 │              │    │               │    │  urgency     │    │                  │
 └──────────────┘    └───────────────┘    └──────────────┘    └──────────────────┘
                                         red flags checked first
📸 Screenshots

Add screenshots or a GIF of the app here.

3D pain map	AI questions	Result + report
3D pain map	AI questions	Result
🛠 Tech stack
Layer	Technology
3D model	Blender (jaw and teeth model)
Frontend	[e.g. React + Vite / Next.js]
3D rendering	[e.g. three.js / React Three Fiber]
Styling	[e.g. Tailwind CSS]
AI	[e.g. model / API used]
Hosting	Vercel

✏️ Replace the bracketed items with the project's actual stack.

🚀 Getting started
Prerequisites
Node.js 18 or newer
npm (or pnpm / yarn)
Installation
bash
# 1. Clone the repo
git clone https://github.com/<your-username>/daant-dost.git
cd daant-dost

# 2. Install dependencies
npm install

# 3. Add environment variables
cp .env.example .env
# then fill in your AI API key, e.g.
# VITE_AI_API_KEY=your_key_here

# 4. Run the dev server
npm run dev

Open the local URL shown in your terminal.

Build for production
bash
npm run build
npm run preview

✏️ Adjust the commands and env variable names to match the project's setup.

📁 Project structure
daant-dost/
├── public/
│   ├── daant-dost-logo.svg     # App logo
│   └── models/                 # 3D jaw / teeth models (.glb)
├── src/
│   ├── components/             # UI + 3D scene components
│   ├── pages/                  # Patient, Student, Teacher views
│   ├── lib/                    # AI + triage logic
│   └── main.*                  # App entry
├── docs/                       # Screenshots for this README
└── README.md

✏️ Update to match the real folder layout.

🗺 Roadmap
 3D jaw pain marking
 AI questions in the user's language
 Muscle / joint / tooth / bone triage with 3 urgency levels
 Care tips + dentist report
 Student practice cases, drills and 3D explorer
 Teacher case writer with AI
 Urdu voice input
 Find a nearby dentist
 Pain diary and follow-ups
 Class dashboard for teachers
 Clinic suite: report inbox, urgency booking, aftercare

✏️ Tick or untick items to match what is live.

⚠️ Medical disclaimer

Daant Dost does not replace a dentist. It provides general guidance to help people decide when and where to seek care. It is not a diagnosis. If you have spreading facial swelling, fever, difficulty swallowing or breathing, or a jaw injury, seek emergency care immediately.

👥 Team

Built with 🦷 by Team Battisi (named after our 32 teeth).

Name	                       Role
Arfin Nasir                    AI & Full-Stack Engineer
Muhammad Haris Hassan	       Clinical Research & Content Lead
Muhammad Anas                  Product Lead & Pitch
Urooj Fatima 	               Creative Creator Analyst              
Zaryab Fazal                   Frontend Developer
