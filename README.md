# Drum Practice

A practice-tracking application for drummers that analyses tempo accuracy in real time and over time. Records drumming sessions, provides live tempo feedback during recording, and generates detailed performance reports with scores and visualisations.

## Features

- **Live tempo feedback** -- real-time gauge showing whether you're ahead, behind, or on tempo during recording (powered by Aubio)
- **Post-session analysis** -- full performance breakdown using BeatNet neural network: accuracy, stability, consistency, and threshold scores mapped to a 1-10 rank
- **Two practice modes** -- Match Tempo (scored against a target BPM) and Freeplay (scored against your own natural tempo)
- **Audio file upload** -- upload existing recordings (WAV, MP3, MP4, M4A, OGG, FLAC, MOV) for offline analysis
- **Session history** -- track progress over time with interactive charts (rank trends, score breakdowns)
- **Metronome** -- optional audible click track in match-tempo mode
- **Data visualisation** -- D3.js radar charts, BPM timeline charts, and zoomable rank history charts

## Architecture

| Layer | Stack |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, D3.js, Socket.IO client |
| Backend | Flask, Flask-SocketIO, SQLAlchemy, eventlet |
| Audio (real-time) | Aubio -- onset detection, beat tracking, tempo comparison |
| Audio (offline) | BeatNet (neural network), librosa, scipy |
| Database | SQLite |
| Auth | In-memory session tokens (PyNaCl for password hashing) |

### Data Flow

**Online (during recording):**

```
Mic -> AudioWorklet -> PCM chunks -> Socket.IO -> Aubio -> chunk_response -> TempoDial
```

**Offline (after recording or file upload):**

```
WAV/audio file -> librosa -> BeatNet -> beat times
  -> filter (40-300 BPM) -> half/double-time correction -> smoothing -> edge trimming
  -> statistics -> scores (accuracy, stability, consistency, threshold) -> rank (1-10)
```

## Prerequisites

- **Python 3.9** (tested with 3.9.9; managed via pyenv)
- **Node.js 18+**
- **npm**

## Setup

### Backend

```bash
cd backend

# Create virtual environment (using pyenv for Python 3.9)
~/.pyenv/versions/3.9.9/bin/python -m venv .venv
source .venv/bin/activate

# Upgrade pip and install build dependencies
pip install --upgrade pip
pip install wheel Cython numpy==1.23.5

# Install madmom (needs --no-build-isolation due to Cython/numpy build deps)
pip install --no-build-isolation madmom==0.16.1

# Install aubio (needs compiler flag on macOS)
CFLAGS="-Wno-incompatible-function-pointer-types" pip install --no-build-isolation aubio==0.4.9

# Install remaining dependencies (comment out BeatNet and madmom lines first, then uncomment after)
pip install --no-deps BeatNet==1.1.3
pip install -r requirements.txt
```

**Note:** Some packages have conflicting version pins. Install order matters -- see the commands above.

### Frontend

```bash
cd frontend
npm install
```

## Running

Start both servers in separate terminals:

**Backend:**

```bash
cd backend
source .venv/bin/activate
python -m server_app.app
```

Runs on `http://localhost:5000`.

**Frontend:**

```bash
cd frontend
npm run dev
```

Runs on `http://localhost:5178`. The Vite dev server proxies `/auth`, `/sessions`, and `/upload` requests to the backend.

## Usage

1. Open `http://localhost:5178`
2. Sign up / log in
3. Choose a mode:
   - **Freeplay** -- your starting tempo becomes the baseline
   - **Match Tempo** -- set a target BPM; optionally enable the metronome
4. Click **Start Recording** -- the live tempo gauge shows feedback as you play
5. Click **Stop Recording** -- BeatNet analyses the full recording
6. View your rank, scores, BPM timeline, and score breakdown
7. **Save Session** to download the WAV and persist results, or **Discard**
8. View past sessions and trends at `/history`

Alternatively, click **Upload File** to analyse an existing audio recording without recording live.

## Project Structure

```
backend/
  server_app/
    app.py                  # Flask app factory, Socket.IO config
    rest_api/
      auth_routes.py        # Login, signup, logout, current user
      practice_session_routes.py  # Session CRUD
      upload_routes.py      # File upload for offline analysis
    socket_api/
      audio.py              # Real-time audio namespace
  audio_processing/
    online.py               # Aubio-based real-time processor
    offline.py              # BeatNet-based post-recording analyser
  auth/
    service.py              # Password hashing, validation
    session.py              # In-memory token store (4hr expiry)
  database/
    models.py               # User, Session, Stats, Score tables
  data_model/
    statistics.py           # TempoStatistics DTO
    scores.py               # QualityScores DTO

frontend/
  src/
    pages/
      RecordPage/           # Recording + live feedback + results
      HistoricalDataPage/   # Session list + rank trend chart
      PerformanceSummaryPage/  # Full session detail + charts
      LoginPage/            # Authentication
      SignupPage/
    components/
      TempoDial.tsx          # Live tempo gauge (react-d3-speedometer)
      NavBar.tsx             # Navigation
      charts/
        RadarChart.tsx       # D3 radar chart (4 score axes)
        BpmTimelineChart.tsx # D3 line chart (BPM over time)
        RankHistoryChart.tsx # D3 time-series (rank + score trends)
    hooks/
      useAudioRecorder.ts   # Full recording lifecycle
      useMetronome.ts       # Web Audio metronome
    lib/
      apiClient.ts          # HTTP client with Bearer auth
      authService.ts        # Auth API calls
      sessionService.ts     # Session API calls
      socketService.ts      # Socket.IO client
      uploadService.ts      # File upload client
      wavUtils.ts           # WAV file builder
    context/
      AuthContext.tsx        # Auth state management
  public/
    pcm_processor.js        # AudioWorklet processor
```

## Scoring System

Four metrics scored 0-1, combined with weights:

| Score | Weight | Measures |
|---|---|---|
| Accuracy | 35% | How close mean tempo was to the target |
| Threshold | 25% | % of beats within +/-10 BPM of target |
| Consistency | 25% | Beat-to-beat timing evenness (CV) |
| Stability | 15% | Overall tempo steadiness (std dev) |

Combined score maps to a 1-10 rank:

| Rank | Tier |
|---|---|
| 10 | Perfect / Machine-like |
| 9 | Extremely tight |
| 8 | Very tight |
| 7 | Tight |
| 6 | Pretty solid |
| 5 | Average |
| 4 | Loose |
| 3 | Very loose |
| 2 | Unsteady |
| 1 | Erratic |

## API

### REST

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/signup` | Create account |
| POST | `/auth/login` | Log in (returns session token) |
| POST | `/auth/logout` | Log out |
| GET | `/auth/current_user` | Get current user info |
| POST | `/sessions` | Save a practice session |
| GET | `/sessions` | List sessions (paginated, sortable) |
| GET | `/sessions/:id` | Get session detail with stats + scores |
| DELETE | `/sessions/:id` | Delete a session |
| POST | `/upload/analyze` | Upload audio file for analysis |

### Socket.IO (`/audio` namespace)

| Event | Direction | Description |
|---|---|---|
| `receive_chunk` | Client -> Server | Send PCM audio chunk |
| `chunk_response` | Server -> Client | Beat detection result (bpm, tempo_match, deviation) |
| `desired_tempo` | Client -> Server | Set target BPM |
| `receive_audio_file` | Client -> Server | Send full WAV for analysis |
| `performance_summary` | Server -> Client | Full analysis results (rank, scores, stats, timeline) |

## License

MIT
