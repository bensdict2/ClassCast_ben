import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
  deleteDoc,
  getDoc,
  addDoc
} from 'firebase/firestore';

const appId = 'my-classroom-app'; 

const firebaseConfig = {
  apiKey: "AIzaSyAUgrP14-UcSZe-cn4kstkIVW5CfIhOkXA",
  authDomain: "classcast-39a37.firebaseapp.com",
  projectId: "classcast-39a37",
  storageBucket: "classcast-39a37.firebasestorage.app",
  messagingSenderId: "740494439681",
  appId: "1:740494439681:web:2ed5ba475d0ea1fe575700",
  measurementId: "G-B0YFXBL8W9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

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
  return Math.floor(10000 + Math.random() * 90000).toString();
};

const extractGoogleSlidesId = (url) => {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
};

const getWordCloudData = (answers) => {
    const counts = {};
    answers.forEach(a => {
        // Support both single words and arrays of words submitted by a student
        const words = Array.isArray(a.selectedOption) ? a.selectedOption : [a.selectedOption];
        words.forEach(w => {
            const word = String(w || '').trim().toUpperCase();
            if (word) counts[word] = (counts[word] || 0) + 1;
        });
    });
    return Object.entries(counts).sort((a,b) => b[1] - a[1]); 
};

const wordCloudColors = ['text-emerald-400', 'text-blue-400', 'text-orange-400', 'text-pink-400', 'text-purple-400', 'text-yellow-400'];

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [isPeerLoaded, setIsPeerLoaded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Login States
  const [showTeacherLogin, setShowTeacherLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    loadPeerJS().then(() => setIsPeerLoaded(true)).catch(err => setErrorMsg(err.message));
    return () => unsubscribe();
  }, []);

  const handleStudentJoin = async () => {
    if (roomCode.length !== 5 || !studentName.trim()) {
      setErrorMsg('Please enter your name and a 5-digit code.');
      return;
    }
    if (!user) {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        setErrorMsg("Failed to connect as student.");
        return;
      }
    }
    setRole('student');
  };

  const handleTeacherAuth = async (e) => {
    e.preventDefault();
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setRoomCode(generateRoomCode());
      setRole('teacher');
    } catch (err) {
      setErrorMsg(err.message.replace('Firebase: ', ''));
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setRoomCode(generateRoomCode());
      setRole('teacher');
    } catch (err) {
      setErrorMsg(err.message.replace('Firebase: ', ''));
    }
  };

  if (!isPeerLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="animate-pulse text-xl font-semibold text-blue-400">Loading Classroom Environment...</div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 text-center relative overflow-hidden">
          <h1 className="text-4xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">ClassCast</h1>
          <p className="text-slate-400 mb-8 text-sm">Interactive Local Screen Broadcasting</p>
          
          {errorMsg && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded-lg mb-6 text-sm">
              {errorMsg}
            </div>
          )}

          {!showTeacherLogin ? (
            <div className="space-y-4">
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
                  onClick={handleStudentJoin}
                  className="w-1/3 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-emerald-500/25 active:scale-95"
                >
                  Join
                </button>
              </div>
              <div className="mt-8 pt-6 border-t border-slate-700">
                <button 
                  onClick={() => setShowTeacherLogin(true)}
                  className="text-slate-400 hover:text-blue-400 text-sm font-medium transition-colors"
                >
                  Are you a teacher? Log in here
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleTeacherAuth} className="space-y-4">
               <button
                 type="button"
                 onClick={handleGoogleLogin}
                 className="w-full py-3 bg-white text-slate-900 rounded-xl font-bold transition-all shadow-lg hover:bg-slate-100 flex items-center justify-center gap-3 mb-4"
               >
                 <svg className="w-5 h-5" viewBox="0 0 24 24">
                   <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                   <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                   <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                   <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                 </svg>
                 Sign in with Google
               </button>
               
               <div className="relative flex py-2 items-center">
                 <div className="flex-grow border-t border-slate-600"></div>
                 <span className="flex-shrink-0 mx-4 text-slate-500 text-xs">OR EMAIL</span>
                 <div className="flex-grow border-t border-slate-600"></div>
               </div>

              <input 
                type="email" 
                placeholder="Email Address" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:blue-500 text-white placeholder-slate-400"
                required
              />
              <input 
                type="password" 
                placeholder="Password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:blue-500 text-white placeholder-slate-400"
                required
              />
              <button 
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95 mt-2"
              >
                {isSignUp ? 'Create Account & Start' : 'Log In to Dashboard'}
              </button>
              
              <div className="mt-6 pt-4 flex flex-col gap-2 border-t border-slate-700">
                <button 
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
                >
                  {isSignUp ? "Already have an account? Log In" : "Need an account? Sign Up"}
                </button>
                <button 
                  type="button"
                  onClick={() => setShowTeacherLogin(false)}
                  className="text-slate-400 hover:text-slate-300 text-sm font-medium transition-colors mt-2"
                >
                  Back to Student Join
                </button>
              </div>
            </form>
          )}
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
  
  const [questionBank, setQuestionBank] = useState([]);
  const [qType, setQType] = useState('mcq');
  const [qText, setQText] = useState('');
  const [qOptions, setQOptions] = useState(['', '']);
  const [wordCloudLimit, setWordCloudLimit] = useState(1);

  const [slideLink, setSlideLink] = useState('');
  const [presentationId, setPresentationId] = useState('');
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const videoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerRef = useRef(null);
  const connectionsRef = useRef({});

  // Keyboard Clicker Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
            e.preventDefault();
            changeSlide(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            e.preventDefault();
            changeSlide(-1);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presentationId, currentSlideIndex]);

  useEffect(() => {
      if (user && user.uid) {
          const bankRef = collection(db, 'artifacts', appId, 'users', user.uid, 'questionBank');
          const unsubscribe = onSnapshot(bankRef, (snapshot) => {
              const questions = [];
              snapshot.forEach(doc => questions.push({ id: doc.id, ...doc.data() }));
              setQuestionBank(questions.sort((a,b) => a.timestamp - b.timestamp));
          });
          return () => unsubscribe();
      }
  }, [user]);

  useEffect(() => {
    let unsubscribe = () => {};
    if (activeQuestion) {
      const answersRef = collection(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode, 'answers');
      unsubscribe = onSnapshot(answersRef, (snapshot) => {
        const results = [];
        snapshot.forEach(doc => {
            if (doc.data().questionId === activeQuestion.id) {
                results.push(doc.data());
            }
        });
        setAnswers(results);
      });
    }
    return () => unsubscribe();
  }, [activeQuestion, roomCode]);

  const loadSlides = async () => {
      const id = extractGoogleSlidesId(slideLink);
      if (id) {
          setPresentationId(id);
          setCurrentSlideIndex(0);
          try {
             const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
             await setDoc(sessionRef, { activeSlide: { id, index: 0 }, activeQuestion: null }, { merge: true });
          } catch(err) { console.error(err); }
      } else {
          setErrorMsg("Invalid Google Slides URL");
      }
  };

  const changeSlide = async (direction) => {
      if (!presentationId) return;
      const nextIndex = Math.max(0, currentSlideIndex + direction);
      setCurrentSlideIndex(nextIndex);
      try {
          const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
          await setDoc(sessionRef, { activeSlide: { id: presentationId, index: nextIndex } }, { merge: true });
      } catch(err) { console.error(err); }
  };

  const openProjector = () => {
     window.open(`/?projector=true&code=${roomCode}`, 'ClassCastProjector', 'width=1280,height=720');
  };

  const startBroadcast = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { max: 1280 }, height: { max: 720 }, frameRate: { max: 5 } },
        audio: false
      });

      localStreamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setIsBroadcasting(true);
      setErrorMsg('');

      stream.getVideoTracks()[0].onended = () => stopBroadcast();

      const teacherPeerId = `classcast-${appId}-${roomCode}-host`;
      const peer = new window.Peer(teacherPeerId);
      peerRef.current = peer;

      peer.on('connection', (conn) => {
        conn.on('data', async (data) => {
          if (data.type === 'request-stream') {
             const call = peer.call(conn.peer, localStreamRef.current);
             connectionsRef.current[conn.peer] = call;
             setStudentCount(Object.keys(connectionsRef.current).length);

             call.on('close', () => {
                 delete connectionsRef.current[conn.peer];
                 setStudentCount(Object.keys(connectionsRef.current).length);
             });
          }
        });
      });
    } catch (err) {
      setErrorMsg("Failed to start screen share.");
    }
  };

  const stopBroadcast = () => {
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(track => track.stop());
    if (peerRef.current) peerRef.current.destroy();
    setIsBroadcasting(false);
    connectionsRef.current = {};
  };

  const saveToBank = async () => {
      if (!qText.trim()) {
          setErrorMsg("Question text cannot be empty."); return;
      }
      const newQuestion = {
          type: qType,
          text: qText,
          options: (qType === 'mcq' || qType === 'rank') ? qOptions.filter(o => o.trim()) : [],
          wordCloudLimit: qType === 'word_cloud' ? wordCloudLimit : 1,
          timestamp: Date.now()
      };
      
      try {
          const bankRef = collection(db, 'artifacts', appId, 'users', user.uid, 'questionBank');
          await addDoc(bankRef, newQuestion);
          setQText(''); setQOptions(['', '']); setWordCloudLimit(1); setErrorMsg('');
      } catch (err) { setErrorMsg("Failed to save to bank."); }
  };

  const launchQuestion = async (qObj) => {
    try {
      const questionData = { ...qObj, id: Date.now().toString(), launchTime: Date.now() };
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
      await setDoc(sessionRef, { activeQuestion: questionData }, { merge: true });
      setActiveQuestion(questionData);
      setAnswers([]);
    } catch (err) {
      setErrorMsg("Failed to send question.");
    }
  };

  const clearQuestion = async () => {
    try {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
      await setDoc(sessionRef, { activeQuestion: null }, { merge: true });
      setActiveQuestion(null);
    } catch (err) { console.error(err); }
  };

  const deleteFromBank = async (id) => {
      try {
          await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'questionBank', id));
      } catch (err) { console.error(err); }
  };

  const formatRankAnswer = (answerArray) => {
      if (!Array.isArray(answerArray)) return answerArray;
      return answerArray.map((item, idx) => (
          <span key={idx} className="mr-2">
              <span className="font-bold text-slate-400">{idx + 1}.</span> {item}
              {idx < answerArray.length - 1 && <span className="text-slate-600 ml-2">➔</span>}
          </span>
      ));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col md:flex-row gap-6 font-sans">
      
      {/* Left Column: Stream & Controls */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
                Teacher Dashboard
                <button onClick={openProjector} className="text-sm bg-indigo-500 hover:bg-indigo-400 px-3 py-1 rounded text-white font-medium flex items-center gap-1 shadow">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                   Open Projector
                </button>
            </h2>
            <p className="text-slate-400">Class Code: <span className="text-emerald-400 font-mono text-xl tracking-wider ml-2">{roomCode}</span></p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-lg border border-slate-700">
              <div className={`w-3 h-3 rounded-full ${studentCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`}></div>
              <span className="text-sm text-slate-300">{studentCount} Students</span>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-xl">{errorMsg}</div>
        )}

        {/* Dual Mode Screen Share / Slides */}
        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 flex flex-col gap-4">
           <div className="flex gap-4">
               <input 
                  type="text" 
                  placeholder="Paste Google Slides 'Anyone with link' URL here..." 
                  value={slideLink}
                  onChange={(e) => setSlideLink(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
               />
               <button onClick={loadSlides} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-colors shadow-lg whitespace-nowrap">
                  Load Slides
               </button>
               <div className="text-slate-500 flex items-center font-bold px-2">OR</div>
               {!isBroadcasting ? (
                  <button onClick={startBroadcast} className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition-colors shadow-lg whitespace-nowrap">
                    Share Screen
                  </button>
               ) : (
                  <button onClick={stopBroadcast} className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold transition-colors shadow-lg whitespace-nowrap">
                    Stop Screen
                  </button>
               )}
           </div>

           <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-slate-700 relative shadow-inner">
               {isBroadcasting ? (
                   <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
               ) : presentationId ? (
                   <>
                       <iframe 
                          src={`https://docs.google.com/presentation/d/${presentationId}/embed?start=false&loop=false&delayms=3000&slide=id.p${currentSlideIndex + 1}`}
                          className="w-full h-full pointer-events-none"
                          frameBorder="0"
                       ></iframe>
                       <div className="absolute inset-0 z-10 pointer-events-auto"></div>
                       <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-4 bg-slate-900/90 p-2 rounded-xl backdrop-blur-sm border border-slate-600/50 z-20">
                           <button onClick={() => changeSlide(-1)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold">◄ Prev</button>
                           <div className="px-4 py-2 font-bold text-slate-300">Slide {currentSlideIndex + 1}</div>
                           <button onClick={() => changeSlide(1)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold">Next ►</button>
                       </div>
                   </>
               ) : (
                   <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                      Load a presentation or share your screen.
                   </div>
               )}
           </div>
        </div>
      </div>

      {/* Right Column: Interactive Questions */}
      <div className="w-full md:w-[400px] flex flex-col gap-6">
        
        {/* Question Builder */}
        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700">
          <h3 className="text-xl font-bold mb-4 text-emerald-400 border-b border-slate-700 pb-2">Question Builder</h3>
          
          <div className="space-y-4">
              <select 
                  value={qType} 
                  onChange={(e) => setQType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
              >
                  <option value="mcq">🔘 Multiple Choice</option>
                  <option value="short">📝 Short Answer</option>
                  <option value="thumbs">👍 Thumbs Up / Down</option>
                  <option value="temp">🌡️ Temperature Check (Emojis)</option>
                  <option value="rank">1️⃣ Rank Order</option>
                  <option value="word_cloud">☁️ Word Cloud</option>
              </select>

              <textarea 
                placeholder={qType === 'word_cloud' ? "e.g. 'In a few words, describe today's lesson...'" : "Type your question here..."}
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 h-20 resize-none"
              />

              {qType === 'word_cloud' && (
                  <div className="flex items-center justify-between bg-slate-900 border border-slate-600 rounded-xl p-3">
                      <label className="text-slate-300 text-sm font-medium">Max words per student:</label>
                      <input 
                          type="number" 
                          min="1" 
                          max="10" 
                          value={wordCloudLimit}
                          onChange={(e) => setWordCloudLimit(parseInt(e.target.value) || 1)}
                          className="bg-slate-800 border border-slate-500 rounded-lg p-2 text-white w-20 focus:outline-none focus:border-blue-500 text-center"
                      />
                  </div>
              )}

              {(qType === 'mcq' || qType === 'rank') && (
                  <div className="space-y-2">
                      {qOptions.map((opt, idx) => (
                          <div key={idx} className="flex gap-2">
                              <input 
                                type="text" 
                                placeholder={`Option ${idx + 1}`}
                                value={opt}
                                onChange={(e) => {
                                    const newOpts = [...qOptions];
                                    newOpts[idx] = e.target.value;
                                    setQOptions(newOpts);
                                }}
                                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-blue-500"
                              />
                              {idx === qOptions.length - 1 && (
                                  <button onClick={() => setQOptions([...qOptions, ''])} className="px-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-bold">+</button>
                              )}
                          </div>
                      ))}
                  </div>
              )}
              
              <button 
                onClick={saveToBank}
                className="w-full py-2 border-2 border-emerald-600 text-emerald-400 hover:bg-emerald-600 hover:text-white rounded-xl font-bold transition-all"
              >
                Save to Question Bank
              </button>
          </div>
        </div>

        {/* Live Active Question Panel */}
        {activeQuestion && (
           <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border-2 border-orange-500 flex flex-col flex-1 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-red-500"></div>
               <div className="flex justify-between items-start mb-4">
                   <h3 className="text-xl font-bold text-white pr-4">{activeQuestion.text}</h3>
                   <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-1 rounded-full font-bold border border-orange-500/30 uppercase">Live</span>
               </div>
               
               <div className="flex-1 overflow-y-auto space-y-2 pr-2 mb-4">
                  {activeQuestion.type === 'word_cloud' ? (
                     <div className="flex flex-wrap gap-2 items-center justify-center pt-4">
                         {getWordCloudData(answers).length === 0 ? (
                             <p className="text-slate-500 italic text-sm">Waiting for words...</p>
                         ) : (
                             getWordCloudData(answers).map(([word, count], idx) => {
                                 // Calculate relative size
                                 const size = Math.min(3, 1 + (count - 1) * 0.4); 
                                 const colorClass = wordCloudColors[idx % wordCloudColors.length];
                                 return (
                                     <span 
                                        key={word} 
                                        className={`font-black ${colorClass} tracking-wide drop-shadow-md transition-all duration-300`}
                                        style={{ fontSize: `${size}rem`, lineHeight: '1' }}
                                     >
                                         {word}
                                     </span>
                                 );
                             })
                         )}
                     </div>
                  ) : answers.length === 0 ? (
                    <p className="text-slate-500 text-sm italic">Waiting for responses...</p>
                  ) : (
                    answers.map((ans, idx) => (
                      <div key={idx} className="bg-slate-900 p-3 rounded-lg border border-slate-700 text-sm">
                        <div className="font-medium text-blue-400 mb-1">{ans.studentName}</div>
                        <div className="text-slate-200">{formatRankAnswer(ans.selectedOption)}</div>
                      </div>
                    ))
                  )}
               </div>

               <button 
                 onClick={clearQuestion}
                 className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all shadow-lg"
               >
                 Close & Clear Question
               </button>
           </div>
        )}

        {/* Question Bank List */}
        {!activeQuestion && (
            <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 flex-1 flex flex-col min-h-[300px]">
               <h3 className="text-xl font-bold mb-4 text-blue-400 border-b border-slate-700 pb-2">Your Banked Questions</h3>
               <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                   {questionBank.length === 0 ? (
                       <p className="text-slate-500 text-center mt-4 italic text-sm">No questions saved.</p>
                   ) : (
                       questionBank.map((q) => (
                           <div key={q.id} className="bg-slate-900 p-3 rounded-xl border border-slate-700 group hover:border-slate-500 transition-colors">
                               <p className="font-semibold text-slate-200 text-sm mb-2">{q.text}</p>
                               <div className="flex gap-2">
                                   <button 
                                      onClick={() => launchQuestion(q)}
                                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 rounded-lg"
                                   >
                                       Launch Live
                                   </button>
                                   <button 
                                      onClick={() => deleteFromBank(q.id)}
                                      className="px-3 bg-slate-700 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors"
                                   >
                                       🗑️
                                   </button>
                               </div>
                           </div>
                       ))
                   )}
               </div>
            </div>
        )}
      </div>
    </div>
  );
}


function StudentView({ user, roomCode, studentName }) {
  const [activeSlide, setActiveSlide] = useState(null);
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const questionIdRef = useRef(null);

  const [isPeerConnected, setIsPeerConnected] = useState(false);
  const videoRef = useRef(null);
  const peerRef = useRef(null);

  const [shortAnswerText, setShortAnswerText] = useState('');
  const [rankOrder, setRankOrder] = useState([]);
  const [wordCloudAnswers, setWordCloudAnswers] = useState(['']);

  useEffect(() => {
    const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setActiveSlide(data.activeSlide || null);

        if (data.activeQuestion) {
          if (questionIdRef.current !== data.activeQuestion.id) {
            setHasAnswered(false);
            setShortAnswerText('');
            setRankOrder([]);
            const limit = data.activeQuestion.wordCloudLimit || 1;
            setWordCloudAnswers(Array(limit).fill(''));
            questionIdRef.current = data.activeQuestion.id;
          }
          setActiveQuestion(data.activeQuestion);
        } else {
          setActiveQuestion(null);
          questionIdRef.current = null;
          setHasAnswered(false);
        }
      }
    });

    const peer = new window.Peer();
    peerRef.current = peer;
    const teacherPeerId = `classcast-${appId}-${roomCode}-host`;

    peer.on('open', () => {
      const conn = peer.connect(teacherPeerId);
      conn.on('open', () => {
        setIsPeerConnected(true);
        conn.send({ type: 'request-stream' });
      });
      conn.on('close', () => setIsPeerConnected(false));
    });

    peer.on('call', (call) => {
      call.answer(); 
      call.on('stream', (remoteStream) => {
        if (videoRef.current) videoRef.current.srcObject = remoteStream;
      });
    });

    return () => {
        unsubscribe();
        if (peerRef.current) peerRef.current.destroy();
    };
  }, [roomCode, appId]);

  const submitAnswer = async (answerData) => {
    if (!activeQuestion) return;
    setHasAnswered(true);
    try {
      const answerRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode, 'answers', user.uid);
      await setDoc(answerRef, {
        studentName: studentName,
        selectedOption: answerData,
        questionId: activeQuestion.id,
        timestamp: Date.now()
      });
    } catch (err) {
      setHasAnswered(false);
    }
  };

  const handleRankClick = (opt) => {
      if (rankOrder.includes(opt)) {
          setRankOrder(rankOrder.filter(o => o !== opt));
      } else {
          setRankOrder([...rankOrder, opt]);
      }
  };

  const updateWordCloudAnswer = (index, value) => {
      const newAnswers = [...wordCloudAnswers];
      newAnswers[index] = value;
      setWordCloudAnswers(newAnswers);
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-black flex flex-col md:flex-row font-sans overflow-hidden z-50">
      
      {/* Slide / Stream Area */}
      <div className={`relative flex-1 h-full transition-all duration-500 ease-in-out ${activeQuestion ? 'md:w-2/3 lg:w-3/4' : 'w-full'}`}>
          <div className="absolute top-4 left-4 z-20 flex gap-2">
              <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                 <span className="text-xs text-white/80 font-medium">{studentName} • {roomCode}</span>
              </div>
          </div>

          <div className="absolute inset-0 z-10 pointer-events-auto"></div>

          {isPeerConnected ? (
             <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain pointer-events-none" />
          ) : activeSlide ? (
             <iframe 
                src={`https://docs.google.com/presentation/d/${activeSlide.id}/embed?start=false&loop=false&delayms=3000&slide=id.p${activeSlide.index + 1}`}
                className="w-full h-full pointer-events-none"
                frameBorder="0"
             ></iframe>
          ) : (
             <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-400 font-medium">Waiting for teacher...</p>
             </div>
          )}
      </div>

      {/* Interactive Sidebar (Slides in when activeQuestion exists) */}
      <div className={`h-full bg-slate-800 border-l border-slate-600 transition-all duration-500 ease-in-out flex flex-col ${activeQuestion ? 'w-full md:w-1/3 lg:w-1/4 translate-x-0' : 'w-0 translate-x-full overflow-hidden border-none'}`}>
          {activeQuestion && (
              <div className="flex-1 flex flex-col p-6 overflow-y-auto">
                 <div className="mb-6">
                     <div className="inline-block bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 border border-orange-500/30">
                       Active Question
                     </div>
                     <h2 className="text-2xl font-bold text-white">{activeQuestion.text}</h2>
                 </div>

                 {!hasAnswered ? (
                     <div className="flex-1 flex flex-col gap-4">
                         {/* Word Cloud Input */}
                         {activeQuestion.type === 'word_cloud' && (
                             <div className="flex flex-col gap-4">
                                <p className="text-slate-400 text-sm text-center">
                                    Type up to <b className="text-white">{activeQuestion.wordCloudLimit || 1}</b> {activeQuestion.wordCloudLimit === 1 ? 'word or phrase' : 'words or phrases'}!
                                </p>
                                <div className="flex flex-col gap-3 max-h-[40vh] overflow-y-auto pr-2">
                                    {wordCloudAnswers.map((ans, idx) => (
                                        <input 
                                           key={idx}
                                           type="text" 
                                           placeholder={`Word ${idx + 1}`}
                                           maxLength={25}
                                           value={ans}
                                           onChange={(e) => updateWordCloudAnswer(idx, e.target.value)}
                                           className="w-full bg-slate-900 border border-slate-600 rounded-xl p-4 text-white text-xl text-center font-bold focus:outline-none focus:border-orange-500 shadow-inner uppercase tracking-wider"
                                        />
                                    ))}
                                </div>
                                <button 
                                   onClick={() => { 
                                       const validAnswers = wordCloudAnswers.filter(a => a.trim());
                                       if(validAnswers.length > 0) submitAnswer(validAnswers); 
                                   }}
                                   className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${wordCloudAnswers.some(a => a.trim()) ? 'bg-orange-600 hover:bg-orange-500 text-white active:scale-95 shadow-lg shadow-orange-500/25' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                                >
                                   Send to Word Cloud
                                </button>
                             </div>
                         )}

                         {/* MCQ Input */}
                         {activeQuestion.type === 'mcq' && activeQuestion.options.map((opt, idx) => (
                             <button
                                key={idx} onClick={() => submitAnswer(opt)}
                                className="w-full py-4 px-4 bg-slate-700 hover:bg-blue-600 text-white text-lg font-medium rounded-xl transition-all border border-slate-600 text-left shadow-md"
                             >
                                {opt}
                             </button>
                         ))}

                         {/* Thumbs Input */}
                         {activeQuestion.type === 'thumbs' && (
                             <div className="flex gap-4">
                                 <button onClick={() => submitAnswer('👍')} className="flex-1 py-8 bg-slate-700 hover:bg-emerald-600 rounded-xl text-5xl transition-transform hover:scale-105">👍</button>
                                 <button onClick={() => submitAnswer('👎')} className="flex-1 py-8 bg-slate-700 hover:bg-red-600 rounded-xl text-5xl transition-transform hover:scale-105">👎</button>
                             </div>
                         )}

                         {/* Temp Check Input */}
                         {activeQuestion.type === 'temp' && (
                             <div className="grid grid-cols-2 gap-4">
                                 <button onClick={() => submitAnswer('🤩 Got it!')} className="py-6 bg-slate-700 hover:bg-emerald-600 rounded-xl text-4xl hover:scale-105">🤩</button>
                                 <button onClick={() => submitAnswer('🤔 Thinking')} className="py-6 bg-slate-700 hover:bg-blue-600 rounded-xl text-4xl hover:scale-105">🤔</button>
                                 <button onClick={() => submitAnswer('😕 Confused')} className="py-6 bg-slate-700 hover:bg-orange-500 rounded-xl text-4xl hover:scale-105">😕</button>
                                 <button onClick={() => submitAnswer('🆘 Help!')} className="py-6 bg-slate-700 hover:bg-red-600 rounded-xl text-4xl hover:scale-105">🆘</button>
                             </div>
                         )}

                         {/* Short Answer Input */}
                         {activeQuestion.type === 'short' && (
                             <div className="flex flex-col gap-4">
                                 <textarea 
                                    value={shortAnswerText} onChange={(e) => setShortAnswerText(e.target.value)}
                                    placeholder="Type your answer..."
                                    className="w-full h-32 bg-slate-900 border border-slate-600 rounded-xl p-4 text-white focus:border-blue-500 resize-none"
                                 />
                                 <button onClick={() => submitAnswer(shortAnswerText)} className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold">Submit Answer</button>
                             </div>
                         )}

                         {/* Rank Input */}
                         {activeQuestion.type === 'rank' && (
                             <div className="flex flex-col gap-4">
                                 <p className="text-slate-400 text-sm">Tap the items in the order you want to rank them.</p>
                                 <div className="flex flex-col gap-2">
                                     {activeQuestion.options.map((opt, idx) => {
                                         const rankIndex = rankOrder.indexOf(opt);
                                         const isSelected = rankIndex !== -1;
                                         return (
                                             <button 
                                                key={idx} onClick={() => handleRankClick(opt)}
                                                className={`w-full p-4 rounded-xl text-left font-medium transition-all flex items-center justify-between ${isSelected ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-700 text-slate-300 border border-slate-600'}`}
                                             >
                                                 <span>{opt}</span>
                                                 {isSelected && <span className="bg-white text-blue-900 w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm">{rankIndex + 1}</span>}
                                             </button>
                                         );
                                     })}
                                 </div>
                                 <button 
                                    onClick={() => submitAnswer(rankOrder)} 
                                    disabled={rankOrder.length !== activeQuestion.options.length}
                                    className={`w-full py-4 rounded-xl font-bold transition-all ${rankOrder.length === activeQuestion.options.length ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                                 >
                                    Submit Ranking
                                 </button>
                             </div>
                         )}
                     </div>
                 ) : (
                     <div className="flex-1 flex flex-col items-center justify-center text-center">
                         <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6">
                            <span className="text-4xl">✅</span>
                         </div>
                         <h3 className="text-xl font-bold text-white mb-2">Answer Submitted!</h3>
                         <p className="text-slate-400 text-sm">Look at the main screen for results.</p>
                     </div>
                 )}
              </div>
          )}
      </div>
    </div>
  );
}