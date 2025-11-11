import React, { useEffect, useRef, useState, useCallback } from 'react'
import { HandLandmarker, PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import './Feed.css'

interface Props {
  mode: string
}

interface Dataset {
  [key: string]: number[][]
}

interface Conflict {
  label: string
  existingCount: number
  incomingCount: number
}

interface Stats {
  totalGestures: number
  totalExamples: number
  gestures: Array<{ label: string; count: number }>
}

const Feed: React.FC<Props> = ({ mode }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null)
  const [poseLandmarker, setPoseLandmarker] = useState<PoseLandmarker | null>(null)
  const [label, setLabel] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info')
  const [dataset, setDataset] = useState<Dataset>({})
  const [error, setError] = useState<string>('')
  const [isInitializing, setIsInitializing] = useState(true)
  const lastVideoTimeRef = useRef(-1)
  const animationFrameRef = useRef<number | null>(null)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [newLabels, setNewLabels] = useState<string[]>([])
  const [pendingDataset, setPendingDataset] = useState<Dataset | null>(null)
  const [conflictDecisions, setConflictDecisions] = useState<Record<string, boolean>>({})
  const [showStats, setShowStats] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shouldReload = params.get('reload') === '1'

    if (shouldReload) {
      window.history.replaceState({}, '', window.location.pathname)
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
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2,
        })
        const poseLM = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        })
        setHandLandmarker(handLM)
        setPoseLandmarker(poseLM)
        setIsInitializing(false)
      } catch {
        setError('Failed to load recognition models. Please refresh the page.')
        setIsInitializing(false)
      }
    }

    const enableWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 }
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => videoRef.current?.play()
        }
      } catch {
        setError('Cannot access camera. Please grant camera permissions and refresh.')
      }
    }

    initLandmarkers()
    enableWebcam()

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const startPrediction = useCallback(() => {
    if (handLandmarker && poseLandmarker && videoRef.current && !error) predictWebcam()
  }, [handLandmarker, poseLandmarker, error])

  useEffect(() => {
    if (handLandmarker && poseLandmarker && videoRef.current) {
      videoRef.current.onloadeddata = startPrediction
    }
    return () => {
      if (videoRef.current) videoRef.current.onloadeddata = null
    }
  }, [handLandmarker, poseLandmarker, startPrediction])

  const drawLandmarks = useCallback((handResults: any, poseResults: any) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    const ctx = canvas.getContext('2d', { willReadFrequently: false })
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    if (handResults?.landmarks && handResults.landmarks.length > 0) {
      const handConnections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [5, 9], [9, 10], [10, 11], [11, 12],
        [9, 13], [13, 14], [14, 15], [15, 16],
        [13, 17], [17, 18], [18, 19], [19, 20],
        [0, 17],
      ]
      
      ctx.strokeStyle = '#00FF00'
      ctx.lineWidth = 2
      ctx.fillStyle = '#FF0000'
      
      for (const landmarks of handResults.landmarks) {
        ctx.beginPath()
        for (const connection of handConnections) {
          const start = landmarks[connection[0]]
          const end = landmarks[connection[1]]
          ctx.moveTo(start.x * canvas.width, start.y * canvas.height)
          ctx.lineTo(end.x * canvas.width, end.y * canvas.height)
        }
        ctx.stroke()
        
        for (const landmark of landmarks) {
          ctx.beginPath()
          ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 4, 0, 2 * Math.PI)
          ctx.fill()
        }
      }
    }

    if (poseResults?.landmarks && poseResults.landmarks.length > 0) {
      const poseLandmarks = poseResults.landmarks[0]
      const shoulderChinIndices = [0, 11, 12]
      
      ctx.strokeStyle = '#00FFFF'
      ctx.lineWidth = 3
      ctx.fillStyle = '#FFFF00'
      
      const start = poseLandmarks[11]
      const end = poseLandmarks[12]
      if (start && end) {
        ctx.beginPath()
        ctx.moveTo(start.x * canvas.width, start.y * canvas.height)
        ctx.lineTo(end.x * canvas.width, end.y * canvas.height)
        ctx.stroke()
      }
      
      for (const idx of shoulderChinIndices) {
        const landmark = poseLandmarks[idx]
        if (landmark) {
          ctx.beginPath()
          ctx.arc(landmark.x * canvas.width, landmark.y * canvas.height, 6, 0, 2 * Math.PI)
          ctx.fill()
        }
      }
    }
  }, [])

  const predictWebcam = useCallback(async () => {
    const video = videoRef.current
    if (!video || !handLandmarker || !poseLandmarker) return
    
    try {
      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime
        const now = performance.now()
        const handResults = await handLandmarker.detectForVideo(video, now)
        const poseResults = await poseLandmarker.detectForVideo(video, now)
        drawLandmarks(handResults, poseResults)
      }
      animationFrameRef.current = requestAnimationFrame(predictWebcam)
    } catch {
      animationFrameRef.current = requestAnimationFrame(predictWebcam)
    }
  }, [handLandmarker, poseLandmarker, drawLandmarks])

  const showMessage = useCallback((text: string, type: 'success' | 'error' | 'info') => {
    setMessage(text)
    setMessageType(type)
    setTimeout(() => setMessage(''), 4000)
  }, [])

  const addExample = useCallback(async () => {
    const trimmedLabel = label.trim()
    if (!trimmedLabel) {
      showMessage('Please enter a label', 'error')
      return
    }
    if (!handLandmarker || !poseLandmarker || !videoRef.current) {
      showMessage('System not ready. Please wait...', 'error')
      return
    }
    
    try {
      const now = performance.now()
      const handResults = await handLandmarker.detectForVideo(videoRef.current, now)
      const poseResults = await poseLandmarker.detectForVideo(videoRef.current, now)
      
      if (!handResults.landmarks || handResults.landmarks.length === 0) {
        showMessage('No hand detected. Please show your hand to the camera.', 'error')
        return
      }
      
      const features: number[] = []
      for (const handLandmarks of handResults.landmarks) {
        for (const lm of handLandmarks) {
          features.push(lm.x, lm.y, lm.z)
        }
      }
      
      if (poseResults.landmarks && poseResults.landmarks.length > 0) {
        const poseLandmarks = poseResults.landmarks[0]
        const indices = [0, 11, 12]
        for (const idx of indices) {
          const lm = poseLandmarks[idx]
          if (lm) features.push(lm.x, lm.y, lm.z, lm.visibility || 0)
          else features.push(0, 0, 0, 0)
        }
      } else {
        features.push(...Array(12).fill(0))
      }
      
      setDataset(prev => {
        const newDataset = { ...prev }
        if (!newDataset[trimmedLabel]) newDataset[trimmedLabel] = []
        newDataset[trimmedLabel].push(features)
        return newDataset
      })
      
      showMessage(`Added example ${(dataset[trimmedLabel]?.length || 0) + 1} for "${trimmedLabel}"`, 'success')
    } catch {
      showMessage('Failed to capture gesture. Please try again.', 'error')
    }
  }, [label, handLandmarker, poseLandmarker, dataset, showMessage])

  const saveDataset = useCallback(async () => {
    if (Object.keys(dataset).length === 0) {
      showMessage('No data to save. Add some examples first.', 'error')
      return
    }
    
    const minExamples = 3
    const insufficientLabels = Object.entries(dataset)
      .filter(([_, examples]) => examples.length < minExamples)
      .map(([label]) => label)
      
    if (insufficientLabels.length > 0) {
      showMessage(`Warning: "${insufficientLabels.join('", "')}" has fewer than ${minExamples} examples.`, 'error')
      return
    }
    
    try {
      const response = await fetch('http://localhost:3000/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset }),
      })
      if (!response.ok) throw new Error()
      showMessage(`Dataset saved successfully! ${getTotalExamples()} examples stored.`, 'success')
      setDataset({})
      setLabel('')
    } catch {
      showMessage('Failed to save dataset. Make sure backend server is running on port 3000.', 'error')
    }
  }, [dataset, showMessage])

  const handleLoadDataset = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      const text = await file.text()
      let incomingDataset: Dataset
      
      try {
        const parsed = JSON.parse(text)
        incomingDataset = parsed.dataset || parsed
      } catch {
        showMessage('Invalid JSON file.', 'error')
        return
      }
      
      for (const label in incomingDataset) {
        if (!Array.isArray(incomingDataset[label])) {
          showMessage(`Invalid data for "${label}"`, 'error')
          return
        }
      }
      
      const response = await fetch('http://localhost:3000/check-conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset: incomingDataset })
      })
      
      if (!response.ok) throw new Error()
      const result = await response.json()
      
      if (result.hasConflicts) {
        setConflicts(result.conflicts)
        setNewLabels(result.newLabels)
        setPendingDataset(incomingDataset)
        const decisions: Record<string, boolean> = {}
        result.conflicts.forEach((c: Conflict) => { decisions[c.label] = false })
        setConflictDecisions(decisions)
      } else {
        await mergeDatasetDirectly(incomingDataset)
      }
    } catch {
      showMessage('Failed to load dataset. Is backend running?', 'error')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [showMessage])

  const mergeDatasetDirectly = useCallback(async (incomingDataset: Dataset) => {
    try {
      const res = await fetch('http://localhost:3000/merge-dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset: incomingDataset,
          replacements: [],
          rejections: []
        })
      })
      if (!res.ok) throw new Error()
      showMessage('Dataset loaded successfully!', 'success')
    } catch {
      showMessage('Failed to merge dataset.', 'error')
    }
  }, [showMessage])

  const handleConflictDecision = useCallback((label: string, replace: boolean) => {
    setConflictDecisions(prev => ({ ...prev, [label]: replace }))
  }, [])

  const confirmMerge = useCallback(async () => {
    if (!pendingDataset) return
    
    const replacements = Object.entries(conflictDecisions)
      .filter(([_, replace]) => replace)
      .map(([label]) => label)
    const rejections = Object.entries(conflictDecisions)
      .filter(([_, replace]) => !replace)
      .map(([label]) => label)
      
    try {
      const response = await fetch('http://localhost:3000/merge-dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset: pendingDataset,
          replacements,
          rejections
        })
      })
      if (!response.ok) throw new Error()
      const result = await response.json()
      showMessage(`Dataset merged! Added: ${result.addedCount}, Replaced: ${result.replacedCount}, Rejected: ${result.rejectedCount}`, 'success')
      setConflicts([])
      setNewLabels([])
      setPendingDataset(null)
      setConflictDecisions({})
    } catch {
      showMessage('Failed to merge dataset.', 'error')
    }
  }, [pendingDataset, conflictDecisions, showMessage])

  const cancelMerge = useCallback(() => {
    setConflicts([])
    setNewLabels([])
    setPendingDataset(null)
    setConflictDecisions({})
    showMessage('Dataset load cancelled', 'info')
  }, [showMessage])

  const getTotalExamples = useCallback(() => {
    return Object.values(dataset).reduce((total, examples) => total + examples.length, 0)
  }, [dataset])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3000/stats')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setStats(data)
      setShowStats(true)
    } catch {
      showMessage('Failed to fetch stats. Is backend running?', 'error')
    }
  }, [showMessage])

  const deleteGesture = useCallback(async (gestureLabel: string) => {
    try {
      const res = await fetch('http://localhost:3000/delete-gesture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: gestureLabel })
      })
      if (!res.ok) throw new Error()
      showMessage(`Deleted gesture: ${gestureLabel}`, 'success')
      setShowDeleteConfirm(false)
      setDeleteTarget(null)
      if (showStats) fetchStats()
    } catch {
      showMessage('Failed to delete gesture.', 'error')
    }
  }, [showMessage, showStats, fetchStats])

  const clearDatabase = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3000/clear-database', {
        method: 'POST'
      })
      if (!res.ok) throw new Error()
      showMessage('Database cleared successfully!', 'success')
      setShowDeleteConfirm(false)
      setDeleteTarget(null)
      if (showStats) setShowStats(false)
    } catch {
      showMessage('Failed to clear database.', 'error')
    }
  }, [showMessage, showStats])

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') addExample()
  }, [addExample])

  return (
    <div className={`feed-container ${mode === 'light' ? 'light-mode' : 'dark-mode'}`}>
      <div className="feed-content">
        <h1>Feed Data from Camera</h1>
        <p className="subtitle">Collect gesture data with hand, shoulder & chin tracking</p>

        {error && (
          <div style={{ background: '#ff4444', color: 'white', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontWeight: '500' }}>
            {error}
          </div>
        )}

        {isInitializing && !error && (
          <div style={{ background: '#4444ff', color: 'white', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
            Initializing body & gesture recognition...
          </div>
        )}

        <div className="video-container">
          <video ref={videoRef} autoPlay playsInline muted className="video-feed" />
          <canvas ref={canvasRef} width={640} height={480} className="canvas-overlay" />
        </div>

        <div className="controls">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter gesture label (e.g., thumbs_up)"
            className="label-input"
            disabled={!!error || isInitializing}
          />
          <button onClick={addExample} className="add-button" disabled={!!error || isInitializing}>
            Add Example
          </button>
          <button onClick={saveDataset} className="save-button" disabled={!!error || Object.keys(dataset).length === 0}>
            Save to Backend
          </button>
          <button
            onClick={async () => {
              const currentDataset = dataset
              if (Object.keys(currentDataset).length === 0) {
                showMessage('No data to save.', 'error')
                return
              }
              try {
                const res = await fetch('http://localhost:3000/share')
                if (res.ok) {
                  const data = await res.json()
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `gesture-dataset-${new Date().toISOString().split('T')[0]}.json`
                  a.click()
                  URL.revokeObjectURL(url)
                  showMessage('Dataset downloaded from server.', 'success')
                  return
                }
              } catch {}
              const fallbackData = {
                metadata: {
                  exportDate: new Date().toISOString(),
                  totalGestures: Object.keys(currentDataset).length,
                  totalExamples: Object.values(currentDataset).reduce((s, a) => s + a.length, 0),
                  version: '1.0'
                },
                dataset: currentDataset
              }
              const blob = new Blob([JSON.stringify(fallbackData, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `gesture-dataset-${new Date().toISOString().split('T')[0]}.json`
              a.click()
              URL.revokeObjectURL(url)
              showMessage('Dataset saved locally (backend offline).', 'info')
            }}
            className="download-button"
            disabled={!!error || Object.keys(dataset).length === 0}
          >
            Save as File
          </button>
          <button onClick={handleLoadDataset} className="load-button" disabled={!!error}>
            Load Dataset
          </button>
          <button onClick={fetchStats} className="stats-button" disabled={!!error}>
            View Stats
          </button>
          <button 
            onClick={() => {
              setDeleteTarget('database')
              setShowDeleteConfirm(true)
            }} 
            className="clear-button" 
            disabled={!!error}
          >
            Clear Database
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>

        {message && (
          <p
            className="message"
            style={{
              color: messageType === 'success' ? '#00ff00' : messageType === 'error' ? '#ff4444' : '#4444ff',
              fontWeight: '500'
            }}
          >
            {message}
          </p>
        )}

        {showStats && stats && (
          <div className="stats-modal">
            <div className="stats-content">
              <h2>Dataset Statistics</h2>
              <div className="stats-summary">
                <div className="stat-item">
                  <span className="stat-label">Total Gestures:</span>
                  <span className="stat-value">{stats.totalGestures}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Examples:</span>
                  <span className="stat-value">{stats.totalExamples}</span>
                </div>
              </div>
              <div className="gesture-list">
                <h3>Gestures:</h3>
                {stats.gestures.map(g => (
                  <div key={g.label} className="gesture-stat-item">
                    <span className="gesture-label">{g.label}</span>
                    <span className="gesture-count">{g.count} examples</span>
                    <button
                      onClick={() => {
                        setDeleteTarget(g.label)
                        setShowDeleteConfirm(true)
                        setShowStats(false)
                      }}
                      className="delete-gesture-btn"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowStats(false)} className="close-stats-btn">
                Close
              </button>
            </div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="delete-confirm-modal">
            <div className="delete-confirm-content">
              <h2>Confirm Deletion</h2>
              <p>
                {deleteTarget === 'database'
                  ? 'Are you sure you want to clear the entire database? This action cannot be undone.'
                  : `Are you sure you want to delete gesture "${deleteTarget}"?`}
              </p>
              <div className="delete-confirm-buttons">
                <button
                  onClick={() => {
                    if (deleteTarget === 'database') {
                      clearDatabase()
                    } else if (deleteTarget) {
                      deleteGesture(deleteTarget)
                    }
                  }}
                  className="confirm-delete-btn"
                >
                  Yes, Delete
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setDeleteTarget(null)
                    if (stats) setShowStats(true)
                  }}
                  className="cancel-delete-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="conflict-modal">
            <div className="conflict-content">
              <h2>Conflicting Labels Found</h2>
              <p className="conflict-description">
                The following gestures already exist. Choose whether to replace them:
              </p>
              <div className="conflict-list">
                {conflicts.map(conflict => (
                  <div key={conflict.label} className="conflict-item">
                    <div className="conflict-info">
                      <span className="conflict-label">{conflict.label}</span>
                      <span className="conflict-details">
                        Existing: {conflict.existingCount} | Incoming: {conflict.incomingCount}
                      </span>
                    </div>
                    <div className="conflict-actions">
                      <button
                        className={`action-btn replace ${conflictDecisions[conflict.label] ? 'active' : ''}`}
                        onClick={() => handleConflictDecision(conflict.label, true)}
                      >
                        Replace
                      </button>
                      <button
                        className={`action-btn reject ${!conflictDecisions[conflict.label] ? 'active' : ''}`}
                        onClick={() => handleConflictDecision(conflict.label, false)}
                      >
                        Keep Existing
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {newLabels.length > 0 && (
                <div className="new-labels-info">
                  <p>New gestures to be added: {newLabels.join(', ')}</p>
                </div>
              )}
              <div className="conflict-buttons">
                <button onClick={confirmMerge} className="confirm-btn">
                  Confirm Merge
                </button>
                <button onClick={cancelMerge} className="cancel-btn">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {Object.keys(dataset).length > 0 && (
          <div className="dataset-info">
            <p className="info-title">Current Session:</p>
            {Object.entries(dataset).map(([key, examples]) => (
              <p key={key} className="gesture-count">
                {key}: {examples.length} example{examples.length !== 1 ? 's' : ''}
                {examples.length < 3 && (
                  <span style={{ color: '#ff8800', marginLeft: '8px', fontSize: '0.9em' }}>
                    (add {3 - examples.length} more)
                  </span>
                )}
              </p>
            ))}
            <p className="total-count">Total: {getTotalExamples()} examples</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Feed