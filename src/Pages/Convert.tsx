import React, { useEffect, useRef, useState } from 'react'
import { HandLandmarker, PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import './Convert.css'

interface Props {
  mode: string
}

interface TranscriptWord {
  id: string
  text: string
}

const Convert: React.FC<Props> = ({ mode }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null)
  const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null)
  const [gesture, setGesture] = useState('')
  const [translatedGesture, setTranslatedGesture] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [dataset, setDataset] = useState<Record<string, number[][]>>({})
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const lastVideoTimeRef = useRef(-1)
  const animationFrameRef = useRef<number | null>(null)
  const isSpeakingRef = useRef(false)
  const lastSpokenRef = useRef('')
  const lastSpeakTimeRef = useRef(0)
  const targetLangRef = useRef('en')
  const [selectedLang, setSelectedLang] = useState('en')
  const [transcript, setTranscript] = useState<TranscriptWord[]>([])
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [hoveredWord, setHoveredWord] = useState<string | null>(null)

  const FRAME_INTERVAL = 100
  const WINDOW_DURATION = 1000
  const frameBuffer = useRef<Array<{ label: string; time: number }>>([])
  const lastProcessTime = useRef(0)
  const lastFrameTime = useRef(0)

  const languages: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    pt: 'Portuguese',
    it: 'Italian',
    ru: 'Russian',
    ar: 'Arabic',
    nl: 'Dutch',
    pl: 'Polish',
    tr: 'Turkish',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    hi: 'Hindi',
    id: 'Indonesian',
    sv: 'Swedish',
    cs: 'Czech',
    el: 'Greek',
    hu: 'Hungarian',
    ro: 'Romanian',
    bg: 'Bulgarian',
    uk: 'Ukrainian',
    fi: 'Finnish',
    da: 'Danish',
  }

  const translateText = async (text: string, targetLang: string): Promise<string> => {
    if (!text.trim() || targetLang === 'en') return text
    try {
      const res = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
      )
      const data = await res.json()
      return data[0]?.[0]?.[0] || text
    } catch {
      return text
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shouldReload = params.get('reload') === '1'

    if (shouldReload) {
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
      window.location.reload()
      return
    }
    const initLandmarkers = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'node_modules/@mediapipe/tasks-vision/wasm'
        )
        const handLM = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        })
        const poseLM = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        })
        setHandLandmarker(handLM)
        setPoseLandmarker(poseLM)
      } catch {
        setError('Failed to load gesture model. Refresh the page.')
      }
    }

    const enableWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => videoRef.current?.play()
        }
      } catch {
        setError('Camera access denied. Please allow camera permission.')
      }
    }

    const fetchDataset = async () => {
      try {
        const res = await fetch('http://localhost:3000/fetch')
        if (!res.ok) throw new Error()
        const data = await res.json()
        setDataset(data)
        setIsLoading(false)
      } catch {
        setError('Cannot reach backend (port 3000).')
        setIsLoading(false)
      }
    }

    initLandmarkers()
    enableWebcam()
    fetchDataset()

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const startPrediction = () => {
    if (handLandmarker && poseLandmarker && videoRef.current) predictWebcam()
  }

  useEffect(() => {
    if (handLandmarker && poseLandmarker && videoRef.current) {
      videoRef.current.onloadeddata = startPrediction
    }
    return () => {
      if (videoRef.current) videoRef.current.onloadeddata = null
    }
  }, [handLandmarker, poseLandmarker, dataset])

  const drawLandmarks = (handResults: any, poseResults: any) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    if (handResults?.landmarks && handResults.landmarks.length > 0) {
      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [5, 9], [9, 10], [10, 11], [11, 12],
        [9, 13], [13, 14], [14, 15], [15, 16],
        [13, 17], [17, 18], [18, 19], [19, 20],
        [0, 17],
      ]
      for (const landmarks of handResults.landmarks) {
        ctx.strokeStyle = '#00FF00'
        ctx.lineWidth = 2
        for (const [i, j] of connections) {
          const a = landmarks[i]
          const b = landmarks[j]
          ctx.beginPath()
          ctx.moveTo(a.x * canvas.width, a.y * canvas.height)
          ctx.lineTo(b.x * canvas.width, b.y * canvas.height)
          ctx.stroke()
        }
        ctx.fillStyle = '#FF0000'
        for (const lm of landmarks) {
          ctx.beginPath()
          ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 4, 0, 2 * Math.PI)
          ctx.fill()
        }
      }
    }

    if (poseResults?.landmarks && poseResults.landmarks.length > 0) {
      const poseLandmarks = poseResults.landmarks[0]
      const indices = [0, 11, 12]
      const connections = [[11, 12]]
      ctx.strokeStyle = '#00FFFF'
      ctx.lineWidth = 3
      for (const [i, j] of connections) {
        const a = poseLandmarks[i]
        const b = poseLandmarks[j]
        if (a && b) {
          ctx.beginPath()
          ctx.moveTo(a.x * canvas.width, a.y * canvas.height)
          ctx.lineTo(b.x * canvas.width, b.y * canvas.height)
          ctx.stroke()
        }
      }
      ctx.fillStyle = '#FFFF00'
      for (const idx of indices) {
        const lm = poseLandmarks[idx]
        if (lm) {
          ctx.beginPath()
          ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 6, 0, 2 * Math.PI)
          ctx.fill()
        }
      }
    }
  }

  const euclideanDistance = (a: number[], b: number[]) => {
    let sum = 0
    const minLen = Math.min(a.length, b.length)
    for (let i = 0; i < minLen; i++) {
      sum += (a[i] - b[i]) ** 2
    }
    return Math.sqrt(sum)
  }

  const predictGesture = (features: number[]): { label: string; confidence: number } | null => {
    const k = 3
    const distances: Array<{ label: string; dist: number }> = []
    for (const label in dataset) {
      const examples = dataset[label]
      for (const example of examples) {
        const dist = euclideanDistance(features, example)
        distances.push({ label, dist })
      }
    }
    if (distances.length === 0) return null
    distances.sort((a, b) => a.dist - b.dist)
    const nearest = distances.slice(0, k)
    const votes: Record<string, number> = {}
    for (const { label } of nearest) {
      votes[label] = (votes[label] || 0) + 1
    }
    let maxVotes = 0
    let predictedLabel = ''
    for (const label in votes) {
      if (votes[label] > maxVotes) {
        maxVotes = votes[label]
        predictedLabel = label
      }
    }
    const confidenceValue = maxVotes / k
    return { label: predictedLabel, confidence: confidenceValue }
  }

  const processBuffer = () => {
    const now = performance.now()
    const cutoff = now - WINDOW_DURATION
    frameBuffer.current = frameBuffer.current.filter(f => f.time > cutoff)

    if (frameBuffer.current.length === 0) {
      if (gesture !== '') lastSpokenRef.current = ''
      setGesture('')
      setTranslatedGesture('')
      setConfidence(0)
      return
    }

    const votes: Record<string, number> = {}
    frameBuffer.current.forEach(f => (votes[f.label] = (votes[f.label] || 0) + 1))

    let max = 0,
      best = ''
    for (const lbl in votes) {
      if (votes[lbl] > max) {
        max = votes[lbl]
        best = lbl
      }
    }

    const conf = max / frameBuffer.current.length
    setGesture(best)
    setConfidence(conf)
    speak(best)
  }

  const speak = async (text: string) => {
    const currentLang = targetLangRef.current
    if (text === '') {
      setTranslatedGesture('')
      return
    }
    const now = Date.now()
    if (isSpeakingRef.current) return
    if (text === lastSpokenRef.current && now - lastSpeakTimeRef.current < 1500) return

    isSpeakingRef.current = true
    lastSpokenRef.current = text
    lastSpeakTimeRef.current = now

    let spokenText = text
    if (currentLang !== 'en') {
      spokenText = await translateText(text, currentLang)
      setTranslatedGesture(spokenText)
    } else {
      setTranslatedGesture(text)
    }

    if (spokenText !== '') {
      setTranscript(prev => {
        const lastEntry = prev[prev.length - 1]
        if (!lastEntry || lastEntry.text !== spokenText) {
          return [...prev, { id: `${Date.now()}-${Math.random()}`, text: spokenText }]
        }
        return prev
      })
    }

    try {
      speechSynthesis.cancel()
      await new Promise(r => setTimeout(r, 100))
      if (!speechSynthesis.getVoices().length) {
        await new Promise<void>(resolve => {
          speechSynthesis.onvoiceschanged = () => {
            speechSynthesis.onvoiceschanged = null
            resolve()
          }
        })
      }
      const utterance = new SpeechSynthesisUtterance(spokenText)
      const langMap: Record<string, string> = {
        en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE',
        zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', hi: 'hi-IN',
        id: 'id-ID', pt: 'pt-BR', it: 'it-IT', ru: 'ru-RU',
        nl: 'nl-NL', sv: 'sv-SE', pl: 'pl-PL', tr: 'tr-TR',
        cs: 'cs-CZ', el: 'el-GR', hu: 'hu-HU',
        ro: 'ro-RO', bg: 'bg-BG', uk: 'uk-UA',
        fi: 'fi-FI', da: 'da-DK', ar: 'ar-SA',
      }
      const bcp = langMap[currentLang] || currentLang
      utterance.lang = bcp
      utterance.rate = 0.9
      utterance.pitch = 1
      utterance.volume = 1
      const voices = speechSynthesis.getVoices()
      const matchingVoice = voices.find(v => v.lang.startsWith(currentLang)) ||
                           voices.find(v => v.lang.startsWith(bcp.split('-')[0])) ||
                           voices[0]
      if (matchingVoice) utterance.voice = matchingVoice
      utterance.onend = () => { isSpeakingRef.current = false }
      utterance.onerror = () => { isSpeakingRef.current = false }
      speechSynthesis.speak(utterance)
    } catch {
      isSpeakingRef.current = false
    }
  }

  const predictWebcam = async () => {
    const video = videoRef.current
    if (!video || !handLandmarker || !poseLandmarker) return
    const now = performance.now()
    try {
      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime
        if (now - lastFrameTime.current >= FRAME_INTERVAL) {
          lastFrameTime.current = now
          const handResults = await handLandmarker.detectForVideo(video, now)
          const poseResults = await poseLandmarker.detectForVideo(video, now)
          drawLandmarks(handResults, poseResults)
          if (handResults.landmarks?.[0] && Object.keys(dataset).length) {
            const feats: number[] = []
            for (const handLandmarks of handResults.landmarks) {
              for (const lm of handLandmarks) {
                feats.push(lm.x, lm.y, lm.z)
              }
            }
            if (poseResults.landmarks && poseResults.landmarks.length > 0) {
              const poseLandmarks = poseResults.landmarks[0]
              const indices = [0, 11, 12]
              for (const idx of indices) {
                const lm = poseLandmarks[idx]
                if (lm) {
                  feats.push(lm.x, lm.y, lm.z, lm.visibility || 0)
                } else {
                  feats.push(0, 0, 0, 0)
                }
              }
            } else {
              feats.push(...Array(12).fill(0))
            }
            const pred = predictGesture(feats)
            if (pred && pred.confidence > 0.6) {
              frameBuffer.current.push({ label: pred.label, time: now })
            }
          }
          if (now - lastProcessTime.current >= WINDOW_DURATION) {
            lastProcessTime.current = now
            processBuffer()
          }
        }
      }
      animationFrameRef.current = requestAnimationFrame(predictWebcam)
    } catch {
      animationFrameRef.current = requestAnimationFrame(predictWebcam)
    }
  }

  const fixGrammar = async (text: string): Promise<string> => {
    try {
      const response = await fetch(
        `https://api.languagetool.org/v2/check`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `text=${encodeURIComponent(text)}&language=auto`
        }
      )
      if (!response.ok) return text
      const data = await response.json()
      let correctedText = text
      if (data.matches && data.matches.length > 0) {
        const matches = data.matches.sort((a: any, b: any) => b.offset - a.offset)
        for (const match of matches) {
          if (match.replacements && match.replacements.length > 0) {
            const replacement = match.replacements[0].value
            correctedText = correctedText.slice(0, match.offset) + replacement + correctedText.slice(match.offset + match.length)
          }
        }
      }
      return correctedText
    } catch {
      return text
    }
  }

  const downloadTranscript = async () => {
    const sentence = transcript.map(w => w.text).join(' ')
    const correctedSentence = await fixGrammar(sentence)
    const blob = new Blob([correctedSentence], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transcript-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const deleteWord = (id: string) => {
    setTranscript(prev => prev.filter(word => word.id !== id))
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItem(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedItem && draggedItem !== id) {
      const draggedIndex = transcript.findIndex(item => item.id === draggedItem)
      const targetIndex = transcript.findIndex(item => item.id === id)
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newTranscript = [...transcript]
        const [removed] = newTranscript.splice(draggedIndex, 1)
        newTranscript.splice(targetIndex, 0, removed)
        setTranscript(newTranscript)
      }
    }
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
  }

  return (
    <div className={`convert-container ${mode === 'light' ? 'light-mode' : 'dark-mode'}`}>
      <div className="convert-content">
        <h1>Gesture Recognition</h1>
        <p className="subtitle">Real-time gesture detection with full body tracking</p>

        {error && (
          <div style={{ background: '#ff4444', color: '#fff', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontWeight: 500 }}>
            {error}
          </div>
        )}

        {isLoading && !error && (
          <div style={{ background: '#4444ff', color: '#fff', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
            Loading gesture dataset...
          </div>
        )}

        <div className="video-container">
          <video ref={videoRef} autoPlay playsInline muted className="video-feed" />
          <canvas ref={canvasRef} width={640} height={480} className="canvas-overlay" />
        </div>

        <div className="controls-row">
          <div className="lang-select">
            <label htmlFor="lang">Speak in:</label>
            <select
              id="lang"
              value={selectedLang}
              onChange={e => {
                const newLang = e.target.value
                targetLangRef.current = newLang
                setSelectedLang(newLang)
              }}
              className="lang-dropdown"
            >
              {Object.entries(languages).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>

          <div className="transcript-controls">
            <button onClick={downloadTranscript} className="control-btn" disabled={transcript.length === 0}>
              Download Transcript
            </button>
          </div>
        </div>

        <div className="result-card">
          <div className="result-label">Detected Gesture</div>
          <div className="result-gesture">{translatedGesture || 'Waiting...'}</div>
          <div className="result-confidence">Confidence: {Math.round(confidence * 100)}%</div>
          <div className="confidence-bar">
            <div className="confidence-fill" style={{ width: `${confidence * 100}%` }} />
          </div>
        </div>

        <div className="transcript-section">
          <h2 className="transcript-title">Sentence Builder</h2>
          {transcript.length === 0 ? (
            <p className="transcript-empty">Start gesturing to build your sentence...</p>
          ) : (
            <div className="sentence-container">
              {transcript.map((word, index) => (
                <span key={word.id} className="word-wrapper">
                  <span
                    className={`word-item ${draggedItem === word.id ? 'dragging' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, word.id)}
                    onDragOver={(e) => handleDragOver(e, word.id)}
                    onDragEnd={handleDragEnd}
                    onMouseEnter={() => setHoveredWord(word.id)}
                    onMouseLeave={() => setHoveredWord(null)}
                  >
                    {word.text}
                    {hoveredWord === word.id && (
                      <button onClick={() => deleteWord(word.id)} className="word-delete-btn">x</button>
                    )}
                  </span>
                  {index < transcript.length - 1 && ' '}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Convert