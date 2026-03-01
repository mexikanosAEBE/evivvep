# Evivvep - Βιντεοκλήσεις (Zoom-like)

Εφαρμογή βιντεοκλήσεων με κωδικό πρόσβασης, admin panel και δωρεάν LiveKit.

## Λειτουργίες

### Χρήστες
- Σύνδεση με **προσωπικό κωδικό** (ο admin δίνει τον κωδικό σε κάθε χρήστη)
- **Μόνο ο πρόεδρος** έχει κάμερα και **κοινοποίηση οθόνης (share screen)**
- Οι υπόλοιποι: μικρόφωνο, σήκωμα χεριού, έξοδος
- **Πρόσβαση από παντού** – LiveKit λειτουργεί παγκοσμίως (δωρεάν tier)

### Admin Panel
- Δημιουργία κλήσεων με κωδικό
- Δημιουργία/επεξεργασία/διαγραφή χρηστών
- Άνοιγμα/κλείσιμο μικροφώνων συμμετεχόντων
- Αποστολή alerts σε όλη την κλήση
- Δημιουργία polls για ψηφοφορία
- Κλείσιμο όλων των μικροφώνων

## Εγκατάσταση (FREE)

### 1. LiveKit Cloud (δωρεάν)

1. Δημιουργήστε λογαριασμό: https://cloud.livekit.io
2. Δημιουργήστε νέο project
3. Αντιγράψτε: **API Key**, **API Secret**, **WebSocket URL**

### 2. Ρύθμιση project

```bash
# Εγκατάσταση dependencies
npm run setup

# Αντιγραφή .env
cd backend
copy .env.example .env

# Επεξεργασία .env - προσθέστε τα LiveKit credentials:
# LIVEKIT_URL=wss://your-project.livekit.cloud
# LIVEKIT_API_KEY=your-api-key
# LIVEKIT_API_SECRET=your-api-secret
# ADMIN_PASSWORD=your-secure-password
```

### 3. Εκκίνηση

**Ανάπτυξη (2 terminals):**
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

Άνοιγμα: http://localhost:5173

**Production:**
```bash
npm run build
npm start
```

Άνοιγμα: http://localhost:3001

## Ροή χρήσης

1. **Admin** μπαίνει στο `/admin`, βάζει κωδικό, δημιουργεί χρήστες και κλήση
2. **Admin** στέλνει τον σύνδεσμο `/join?code=ABC123` στους συμμετέχοντες
3. **Συμμετέχοντες** ανοίγουν τον σύνδεσμο, επιλέγουν το όνομά τους και μπαίνουν
4. **Πρόεδρος** (ο host που επιλέχθηκε στη δημιουργία) έχει κάμερα και κοινοποίηση οθόνης
5. **Admin** μπορεί να στέλνει alerts, polls και να ελέγχει μικρόφωνα

## Πρόσβαση από παντού (δωρεάν)

- **LiveKit Cloud** έχει servers παγκοσμίως – οι συμμετέχοντες μπαίνουν από οπουδήποτε χωρίς επιπλέον ρύθμιση.
- Για να είναι η εφαρμογή ανοιχτή στον κόσμο, κάντε deploy το backend + frontend σε δωρεάν hosting π.χ.:
  - **Backend:** [Railway](https://railway.app), [Render](https://render.com) (Node.js)
  - **Frontend:** [Vercel](https://vercel.com), [Netlify](https://netlify.com)
  - Ορίστε στο frontend `VITE_API_URL` στο URL του backend. Στο backend ορίστε `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` από το LiveKit Cloud (δωρεάν).
- Όποιος έχει το link και τον προσωπικό του κωδικό μπαίνει από οποιαδήποτε χώρα.

## Τεχνολογίες

- **Frontend:** React, Vite, LiveKit React Components
- **Backend:** Node.js, Express, Socket.IO
- **Βάση:** SQLite (τοπική)
- **Video:** LiveKit (δωρεάν tier: 5.000 λεπτά/μήνα)

## Self-hosted LiveKit (100% δωρεάν)

Για απεριόριστες κλήσεις χωρίς όρια:

```bash
# Docker
docker run --rm -p 7880:7880 -p 7881:7881 -e LIVEKIT_KEYS="devkey: secret" livekit/livekit-server
```

Στο `.env`:
```
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
```
