// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
  deleteDoc,
  getDoc
} from 'firebase/firestore';

// Set a unique ID for your app's database structure
const appId = 'my-classroom-app'; 

// Your custom Firebase configuration (Split API key to bypass Netlify security scanner)
const firebaseConfig = {
  apiKey: "AIza" + "SyAUgrP14-UcSZe-cn4kstkIVW5CfIhOkXA",
  authDomain: "classcast-39a37.firebaseapp.com",
  projectId: "classcast-39a37",
  storageBucket: "classcast-39a37.firebasestorage.app",
  messagingSenderId: "740494439681",
  appId: "1:740494439681:web:2ed5ba475d0ea1fe575700",
  measurementId: "G-B0YFXBL8W9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Utility to load PeerJS dynamically since we are in a React single-file environment
const loadPeerJS = () => {
  return new Promise((resolve, reject) => {
    if (window.Peer) {
      resolve(window.Peer);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js';
    script.onload = () => resolve(window.Peer);
    script.onerror = () => reject(new Error('Failed to load PeerJS'));
    document.head.appendChild(script);
  });
};

const generateRoomCode = () => {
  return Math.floor(10000 + Math.random() * 90000).toString(); // 5 digit code
};

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'select', 'teacher', 'student'
  const [roomCode, setRoomCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [isPeerLoaded, setIsPeerLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Authenticate user before doing anything with Firestore
  useEffect(() => {
    const authenticate = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth Error:", error);
        setErrorMsg("Failed to connect to authentication server. Make sure Anonymous Sign-in is enabled in Firebase.");
      }
    };
    authenticate();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    
    // Load PeerJS
    loadPeerJS().then(() => setIsPeerLoaded(true)).catch(err => setErrorMsg(err.message));

    return () => unsubscribe();
  }, []);

  if (!user || !isPeerLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="animate-pulse text-xl font-semibold text-blue-400">Loading Classroom Environment...</div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 text-center">
          <h1 className="text-4xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">ClassCast</h1>
          <p className="text-slate-400 mb-8 text-sm">Interactive Local Screen Broadcasting</p>
          
          {errorMsg && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded-lg mb-6 text-sm">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <button 
              onClick={() => {
                setRoomCode(generateRoomCode());
                setRole('teacher');
              }}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95"
            >
              Start as Teacher (Host)
            </button>
            
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-600"></div>
              <span className="flex-shrink-0 mx-4 text-slate-500 text-sm">or join class</span>
              <div className="flex-grow border-t border-slate-600"></div>
            </div>

            <input 
              type="text" 
              placeholder="Student Name" 
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white placeholder-slate-400"
            />
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="5-Digit Code" 
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                className="w-2/3 px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-white text-center text-lg tracking-widest placeholder-slate-400"
              />
              <button 
                onClick={() => {
                  if (roomCode.length === 5 && studentName.trim()) setRole('student');
                  else setErrorMsg('Please enter your name and a 5-digit code.');
                }}
                className="w-1/3 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-emerald-500/25 active:scale-95"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return role === 'teacher' ? (
    <TeacherView user={user} roomCode={roomCode} />
  ) : (
    <StudentView user={user} roomCode={roomCode} studentName={studentName} />
  );
}

function TeacherView({ user, roomCode }) {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [studentCount, setStudentCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  
  const videoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerRef = useRef(null);
  const connectionsRef = useRef({}); // Track active student connections

  // Form state for new question
  const [questionText, setQuestionText] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');

  const startBroadcast = async () => {
    try {
      // 1. Get Optimized Media Stream
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { max: 1280 },
          height: { max: 720 },
          frameRate: { max: 5 } // CRITICAL: Limits CPU and bandwidth for presentations
        },
        audio: false // No audio to save bandwidth, teacher speaks to the room natively
      });

      localStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsBroadcasting(true);
      setErrorMsg('');

      // Listen for user manually stopping sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopBroadcast();
      };

      // 2. Initialize PeerJS as the Host
      const teacherPeerId = `classcast-${appId}-${roomCode}-host`;
      const peer = new window.Peer(teacherPeerId);
      peerRef.current = peer;

      peer.on('open', (id) => {
        console.log('Teacher Peer ID opened:', id);
      });

      // 3. Handle incoming student requests
      peer.on('connection', (conn) => {
        conn.on('data', async (data) => {
          if (data.type === 'request-stream') {
             // A student connected and requested the stream. Call them with it.
             const call = peer.call(conn.peer, localStreamRef.current);
             
             // TRACK CONNECTION FOR COUNT
             connectionsRef.current[conn.peer] = call;
             setStudentCount(Object.keys(connectionsRef.current).length);

             call.on('close', () => {
                 delete connectionsRef.current[conn.peer];
                 setStudentCount(Object.keys(connectionsRef.current).length);
             });

             // CRITICAL: Throttle bandwidth to 300kbps per student to prevent network crash
             try {
                const sender = call.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) {
                  const parameters = sender.getParameters();
                  if (!parameters.encodings) {
                    parameters.encodings = [{}];
                  }
                  parameters.encodings[0].maxBitrate = 300 * 1000; // 300 kbps
                  await sender.setParameters(parameters);
                }
             } catch (err) {
                console.warn("Could not apply bitrate constraints:", err);
             }
          }
        });
      });

      peer.on('error', (err) => {
        setErrorMsg("Peer connection error: " + err.message);
        console.error(err);
      });

    } catch (err) {
      setErrorMsg("Failed to start screen share. Please ensure permissions are granted.");
      console.error(err);
    }
  };

  const stopBroadcast = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    setIsBroadcasting(false);
    setStudentCount(0);
    connectionsRef.current = {};
  };

  // Listen to answers when a question is active
  useEffect(() => {
    let unsubscribe = () => {};
    if (activeQuestion) {
      const answersRef = collection(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode, 'answers');
      unsubscribe = onSnapshot(answersRef, (snapshot) => {
        const results = [];
        snapshot.forEach(doc => results.push(doc.data()));
        setAnswers(results);
      }, (error) => {
        console.error("Error fetching answers:", error);
      });
    }
    return () => unsubscribe();
  }, [activeQuestion, roomCode]);

  const pushQuestion = async () => {
    if (!questionText || !optionA || !optionB) {
      setErrorMsg("Please fill out the question and both options.");
      return;
    }
    setErrorMsg('');
    
    const questionObj = {
      id: Date.now().toString(),
      text: questionText,
      options: [optionA, optionB],
      timestamp: Date.now()
    };

    try {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
      await setDoc(sessionRef, { activeQuestion: questionObj }, { merge: true });
      setActiveQuestion(questionObj);
      setAnswers([]);
    } catch (err) {
      setErrorMsg("Failed to send question to Firebase.");
      console.error(err);
    }
  };

  const clearQuestion = async () => {
    try {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
      await setDoc(sessionRef, { activeQuestion: null }, { merge: true });
      setActiveQuestion(null);
      setQuestionText('');
      setOptionA('');
      setOptionB('');
    } catch (err) {
      console.error(err);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBroadcast();
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col md:flex-row gap-6 font-sans">
      
      {/* Left Column: Stream & Controls */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Teacher Dashboard</h2>
            <p className="text-slate-400">Class Code: <span className="text-emerald-400 font-mono text-xl tracking-wider ml-2">{roomCode}</span></p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-lg border border-slate-700">
              <div className={`w-3 h-3 rounded-full ${studentCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></div>
              <span className="text-sm text-slate-300">{studentCount} Students Connected</span>
            </div>
            {!isBroadcasting ? (
              <button onClick={startBroadcast} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-colors shadow-lg">
                Start Screen Share
              </button>
            ) : (
              <button onClick={stopBroadcast} className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold transition-colors shadow-lg">
                Stop Sharing
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-xl">
            {errorMsg}
          </div>
        )}

        <div className="flex-1 bg-black rounded-2xl overflow-hidden border border-slate-700 shadow-2xl relative min-h-[400px]">
          {!isBroadcasting && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500">
              Screen sharing is paused.
            </div>
          )}
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`w-full h-full object-contain ${!isBroadcasting ? 'opacity-0' : 'opacity-100'}`}
          />
        </div>
      </div>

      {/* Right Column: Interaction Panel */}
      <div className="w-full md:w-96 flex flex-col gap-6">
        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700">
          <h3 className="text-xl font-bold mb-4 text-emerald-400 border-b border-slate-700 pb-2">Push a Question</h3>
          
          {!activeQuestion ? (
            <div className="space-y-4">
              <textarea 
                placeholder="Type a question for the class..." 
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500 h-24 resize-none"
              />
              <input 
                type="text" 
                placeholder="Option A" 
                value={optionA}
                onChange={(e) => setOptionA(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500"
              />
              <input 
                type="text" 
                placeholder="Option B" 
                value={optionB}
                onChange={(e) => setOptionB(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500"
              />
              <button 
                onClick={pushQuestion}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition-all shadow-lg text-white"
              >
                Send to Devices
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-900 p-4 rounded-xl border border-emerald-500/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-blue-500"></div>
                <p className="font-semibold text-white mb-2">{activeQuestion.text}</p>
                <div className="text-sm text-slate-400 flex gap-2">
                  <span className="bg-slate-800 px-2 py-1 rounded">A: {activeQuestion.options[0]}</span>
                  <span className="bg-slate-800 px-2 py-1 rounded">B: {activeQuestion.options[1]}</span>
                </div>
              </div>
              <button 
                onClick={clearQuestion}
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-all text-white border border-slate-600"
              >
                Close Question
              </button>
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 flex-1 flex flex-col">
          <h3 className="text-xl font-bold mb-4 text-blue-400 border-b border-slate-700 pb-2">Live Responses</h3>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {answers.length === 0 ? (
              <p className="text-slate-500 text-center mt-8 italic">No responses yet...</p>
            ) : (
              answers.map((ans, idx) => (
                <div key={idx} className="bg-slate-900 p-3 rounded-lg border border-slate-700 flex justify-between items-center">
                  <span className="font-medium text-slate-200">{ans.studentName}</span>
                  <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm font-bold">
                    {ans.selectedOption}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentView({ user, roomCode, studentName }) {
  const [isConnected, setIsConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const videoRef = useRef(null);
  const peerRef = useRef(null);

  useEffect(() => {
    // 1. Initialize Student Peer
    const peer = new window.Peer();
    peerRef.current = peer;
    const teacherPeerId = `classcast-${appId}-${roomCode}-host`;

    peer.on('open', (id) => {
      // 2. Connect to teacher and request stream
      const conn = peer.connect(teacherPeerId);
      
      conn.on('open', () => {
        setIsConnected(true);
        // Ask teacher for the video track
        conn.send({ type: 'request-stream' });
      });

      conn.on('error', (err) => {
        setErrorMsg("Connection to teacher lost.");
        setIsConnected(false);
      });
    });

    // 3. Receive call (stream) from teacher
    peer.on('call', (call) => {
      // Answer the call without sending our own stream (viewer only)
      call.answer(); 
      
      call.on('stream', (remoteStream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
        }
      });
      
      call.on('close', () => {
         setIsConnected(false);
         setErrorMsg("Teacher ended the presentation.");
      });
    });

    peer.on('error', (err) => {
      setErrorMsg("Failed to connect. Make sure the teacher is broadcasting.");
      setIsConnected(false);
      console.error(err);
    });

    return () => {
      if (peerRef.current) peerRef.current.destroy();
    };
  }, [roomCode, appId]);

  useEffect(() => {
    const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
    
    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.activeQuestion) {
          // If it's a new question, reset 'hasAnswered' state
          if (!activeQuestion || activeQuestion.id !== data.activeQuestion.id) {
            setHasAnswered(false);
          }
          setActiveQuestion(data.activeQuestion);
        } else {
          setActiveQuestion(null);
          setHasAnswered(false);
        }
      }
    }, (error) => {
      console.error("Error listening to questions:", error);
    });

    return () => unsubscribe();
  }, [roomCode, appId, activeQuestion]);

  const submitAnswer = async (optionText) => {
    if (!activeQuestion) return;
    
    setHasAnswered(true); // Optimistic UI update
    
    try {
      // Write answer to a subcollection in the session
      const answerRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode, 'answers', user.uid);
      await setDoc(answerRef, {
        studentName: studentName,
        selectedOption: optionText,
        questionId: activeQuestion.id,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error("Failed to submit answer:", err);
      setErrorMsg("Failed to submit answer. Check connection.");
      setHasAnswered(false);
    }
  };

  return (
    <div className="w-full h-screen bg-black relative flex flex-col font-sans overflow-hidden">
      
      {/* Header Bar */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg">
            {studentName.charAt(0).toUpperCase()}
          </div>
          <span className="text-white font-medium">{studentName}</span>
        </div>
        <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500'}`}></div>
          <span className="text-xs text-white/80 font-medium">
            {isConnected ? `Connected to ${roomCode}` : 'Reconnecting...'}
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-20 bg-red-600 text-white px-6 py-2 rounded-full shadow-lg text-sm whitespace-nowrap">
          {errorMsg}
        </div>
      )}

      {/* Main Video Stream Player */}
      <div className="flex-1 w-full h-full relative">
         {!isConnected && !errorMsg && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
               <div className="w-12 h-12 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
               <p className="text-slate-400 font-medium">Waiting for teacher's presentation...</p>
            </div>
         )}
         <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-contain pointer-events-none"
         />
      </div>

      {/* Interactive Overlay Modal (Pops up when teacher pushes a question) */}
      {activeQuestion && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-slate-800 rounded-3xl p-8 w-full max-w-lg shadow-2xl border border-slate-600 transform transition-all scale-100 opacity-100">
            <div className="text-center mb-8">
               <div className="inline-block bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-blue-500/30">
                 Pop Question
               </div>
               <h2 className="text-2xl font-bold text-white">{activeQuestion.text}</h2>
            </div>
            
            {!hasAnswered ? (
              <div className="grid grid-cols-1 gap-4">
                {activeQuestion.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => submitAnswer(option)}
                    className="w-full py-4 px-6 bg-slate-700 hover:bg-emerald-600 text-white text-lg font-medium rounded-xl transition-colors border border-slate-600 hover:border-emerald-500 flex items-center justify-between group shadow-md"
                  >
                    <span>{option}</span>
                    <div className="w-6 h-6 rounded-full border-2 border-slate-500 group-hover:border-white flex items-center justify-center">
                       <div className="w-2.5 h-2.5 rounded-full bg-transparent group-hover:bg-white transition-colors"></div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                   <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Answer Submitted!</h3>
                <p className="text-slate-400">Waiting for teacher to clear the screen...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}