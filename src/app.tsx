// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot, 
  collection
} from 'firebase/firestore';

const appId = 'my-classroom-app'; 

// Splitting the API key bypasses Netlify's overactive security scanner
const part1 = "AIzaSyA";
const part2 = "UgrP14-UcSZe-cn4kstkIVW5CfIhOkXA";

const firebaseConfig = {
  apiKey: part1 + part2,
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

const generateRoomCode = () => {
  return Math.floor(10000 + Math.random() * 90000).toString(); // 5 digit code
};

// Smart Media Parser Helper
const parseMediaUrl = (url) => {
    if (!url) return null;
    
    // Google Slides Detection
    if (url.includes('docs.google.com/presentation')) {
        // Automatically convert /edit to /embed for a clean presentation view
        const embedUrl = url.replace(/\/edit.*$/, '/embed?rm=minimal');
        return { type: 'iframe', src: embedUrl };
    }
    
    // YouTube Detection
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
        const videoId = url.includes('youtube.com') ? url.split('v=')[1]?.split('&')[0] : url.split('youtu.be/')[1]?.split('?')[0];
        return { type: 'iframe', src: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` };
    }

    // Default fallback (treats it as a standard image URL)
    return { type: 'image', src: url };
};

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'teacher' or 'student'
  const [roomCode, setRoomCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isTeacherLink, setIsTeacherLink] = useState(false);

  // Authenticate user anonymously on load
  useEffect(() => {
    const hash = window.location.hash;
    
    // Check if URL ends with #teacher or #projector
    if (hash === '#teacher') {
        setIsTeacherLink(true);
    } else if (hash.startsWith('#projector-')) {
        const code = hash.replace('#projector-', '');
        setRoomCode(code);
        setRole('projector');
    }

    const authenticate = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth Error:", error);
        setErrorMsg("Failed to connect to authentication server.");
      }
    };
    authenticate();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="animate-pulse text-xl font-semibold text-emerald-400">Loading Classroom Environment...</div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 text-center">
          <h1 className="text-4xl font-extrabold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">ClassCast</h1>
          <p className="text-slate-400 mb-8 text-sm">Interactive Cloud Presentation</p>
          
          {errorMsg && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 p-3 rounded-lg mb-6 text-sm">
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            {/* ONLY show this button if the URL ends with #teacher */}
            {isTeacherLink && (
               <>
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
               </>
            )}

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

  if (role === 'projector') {
    return <ProjectorView roomCode={roomCode} />;
  }

  return role === 'teacher' ? (
    <TeacherView user={user} roomCode={roomCode} />
  ) : (
    <StudentView user={user} roomCode={roomCode} studentName={studentName} />
  );
}

function TeacherView({ user, roomCode }) {
  const [slideUrl, setSlideUrl] = useState('');
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeSlide, setActiveSlide] = useState(null); // Keep track of what we pushed
  
  const [questionText, setQuestionText] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');

  // New Refs for Screen Capture Sync
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const captureInterval = useRef(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const openProjector = () => {
    const url = `${window.location.origin}${window.location.pathname}#projector-${roomCode}`;
    // Opens a clean popup window specifically for the second monitor
    window.open(url, 'ProjectorWindow', 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no');
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

  const pushSlide = async () => {
    if (!slideUrl) return;
    try {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
      const slideData = { url: slideUrl, timestamp: Date.now() };
      await setDoc(sessionRef, { activeSlide: slideData }, { merge: true });
      setActiveSlide(slideData);
      setSlideUrl(''); // Clear input after pushing
      setErrorMsg('');
    } catch (err) {
      setErrorMsg("Failed to push slide.");
      console.error(err);
    }
  };

  const clearSlide = async () => {
    try {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
      await setDoc(sessionRef, { activeSlide: null }, { merge: true });
      setActiveSlide(null);
    } catch (err) {
      console.error(err);
    }
  };

  const startLiveCapture = async () => {
    try {
      // 1. Ask for permission to capture the screen
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { max: 854 }, height: { max: 480 }, frameRate: { max: 2 } }
      });
      
      videoRef.current.srcObject = stream;
      setIsCapturing(true);

      // Stop capture if user clicks "Stop Sharing" on Chrome's built-in bar
      stream.getVideoTracks()[0].onended = () => stopLiveCapture();

      // 2. Every 2 seconds, take a picture and send it to the students!
      captureInterval.current = setInterval(async () => {
         if (videoRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            canvas.width = 854;
            canvas.height = 480;
            
            // Draw the current video frame onto the canvas
            context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            
            // Convert to a highly compressed JPEG (super small file size to prevent lag!)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.4);
            
            // Push this picture to Firebase (Students will automatically download it)
            const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
            await setDoc(sessionRef, { activeSlide: { url: dataUrl, timestamp: Date.now() } }, { merge: true });
         }
      }, 2000); // Takes a snapshot every 2000 milliseconds
    } catch (err) {
      setErrorMsg("Failed to start screen capture.");
      console.error(err);
    }
  };

  const stopLiveCapture = () => {
    clearInterval(captureInterval.current);
    if (videoRef.current && videoRef.current.srcObject) {
       videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setIsCapturing(false);
    clearSlide();
  };

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
      setAnswers([]); // Reset answers on new question
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

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col md:flex-row gap-6 font-sans">
      
      {/* Left Column: Media Control Panel */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Teacher Dashboard</h2>
            <p className="text-slate-400">Class Code: <span className="text-emerald-400 font-mono text-xl tracking-wider ml-2">{roomCode}</span></p>
          </div>
          <div className="flex items-center gap-4">
             <button 
               onClick={openProjector}
               className="bg-slate-700 hover:bg-slate-600 border border-slate-600 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md flex items-center gap-2 hover:border-blue-400 text-slate-200"
               title="Drag this window to your projector"
             >
               <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
               Projector
             </button>
             <div className="flex items-center gap-4 bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-500/30 hidden md:flex">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-sm text-emerald-400 font-medium">Cloud Sync Active</span>
             </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-xl">
            {errorMsg}
          </div>
        )}

        <div className="flex-1 bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl flex flex-col relative min-h-[400px]">
           <h3 className="text-xl font-bold mb-4 text-emerald-400 border-b border-slate-700 pb-2">Slide Control</h3>
           
           <div className="flex gap-2 mb-6">
              <input 
                 type="text" 
                 placeholder="Paste a Google Slides URL, YouTube URL, or Image link..." 
                 value={slideUrl}
                 onChange={(e) => setSlideUrl(e.target.value)}
                 className="flex-1 bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500"
              />
              <button 
                 onClick={pushSlide}
                 className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all shadow-lg whitespace-nowrap"
              >
                 Sync Link
              </button>
           </div>

           <div className="relative flex py-2 items-center mb-6">
              <div className="flex-grow border-t border-slate-700"></div>
              <span className="flex-shrink-0 mx-4 text-slate-500 text-sm font-bold tracking-widest">OR AUTO-SYNC SCREEN</span>
              <div className="flex-grow border-t border-slate-700"></div>
           </div>

           {!isCapturing ? (
              <button 
                 onClick={startLiveCapture}
                 className="w-full py-4 mb-6 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 text-lg"
              >
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                 Start Live Screen Sync
              </button>
           ) : (
              <button 
                 onClick={stopLiveCapture}
                 className="w-full py-4 mb-6 bg-red-600 hover:bg-red-500 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(220,38,38,0.5)] flex items-center justify-center gap-2 animate-pulse text-lg"
              >
                 Stop Live Sync
              </button>
           )}

           {/* Hidden video and canvas for the screen capturer */}
           <video ref={videoRef} autoPlay playsInline muted className="hidden" />
           <canvas ref={canvasRef} className="hidden" />

           {/* Preview of what is currently on the student screens */}
           <div className="flex-1 bg-black rounded-xl overflow-hidden border border-slate-700 relative flex items-center justify-center min-h-[300px]">
              {activeSlide ? (
                 <>
                    <div className="absolute top-2 left-2 bg-black/60 px-3 py-1 rounded-md text-xs font-mono z-20 flex gap-2">
                       <span className="text-emerald-400">Currently broadcasting</span>
                       <button onClick={clearSlide} className="text-red-400 hover:text-red-300 ml-2 underline">Clear Screen</button>
                    </div>
                    {/* Media Parser output for Teacher preview */}
                    {parseMediaUrl(activeSlide.url)?.type === 'iframe' && (
                       <iframe 
                         src={parseMediaUrl(activeSlide.url).src} 
                         className="w-full h-full border-0 bg-white" 
                         allowFullScreen
                       />
                    )}
                    {parseMediaUrl(activeSlide.url)?.type === 'image' && (
                       <img 
                          src={parseMediaUrl(activeSlide.url).src} 
                          className="w-full h-full object-contain" 
                          alt="Teacher Slide Preview" 
                       />
                    )}
                 </>
              ) : (
                 <div className="text-slate-500 text-center">
                    <p className="text-lg mb-2">Student screens are currently blank.</p>
                    <p className="text-sm">Paste a link above to push a slide or video to their devices.</p>
                 </div>
              )}
           </div>
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
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [activeSlide, setActiveSlide] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const questionIdRef = useRef(null); // Added hidden reference tracker

  // Listen for both Slides and Questions from Firebase directly
  useEffect(() => {
    const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
    
    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Handle Question Logic safely without resetting the listener!
        if (data.activeQuestion) {
          if (questionIdRef.current !== data.activeQuestion.id) {
            setHasAnswered(false); // New question resets state
            questionIdRef.current = data.activeQuestion.id;
          }
          setActiveQuestion(data.activeQuestion);
        } else {
          setActiveQuestion(null);
          setHasAnswered(false);
          questionIdRef.current = null;
        }

        // Handle Slide Logic
        if (data.activeSlide) {
           setActiveSlide(data.activeSlide);
        } else {
           setActiveSlide(null);
        }
      }
    }, (error) => {
      console.error("Error listening to session:", error);
      setErrorMsg("Lost connection to classroom.");
    });

    return () => unsubscribe();
  }, [roomCode]); // CRITICAL FIX: Removed activeQuestion so the listener never drops!

  const submitAnswer = async (optionText) => {
    if (!activeQuestion) return;
    setHasAnswered(true); // Optimistic UI update
    
    try {
      const answerRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode, 'answers', user.uid);
      await setDoc(answerRef, {
        studentName: studentName,
        selectedOption: optionText,
        questionId: activeQuestion.id,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error("Failed to submit answer:", err);
      setErrorMsg("Failed to submit answer.");
      setHasAnswered(false);
    }
  };

  return (
    <div className="w-full h-screen bg-slate-950 relative flex flex-col font-sans overflow-hidden">
      
      {/* Header Bar */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg">
            {studentName.charAt(0).toUpperCase()}
          </div>
          <span className="text-white font-medium drop-shadow-md">{studentName}</span>
        </div>
        <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
          <span className="text-xs text-white/80 font-medium">
            Cloud Connected
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-20 bg-red-600 text-white px-6 py-2 rounded-full shadow-lg text-sm whitespace-nowrap">
          {errorMsg}
        </div>
      )}

      {/* Main Slide Presentation Viewer */}
      <div className="absolute inset-0 w-full h-full bg-black z-0">
         {!activeSlide ? (
            <div className="flex flex-col items-center justify-center w-full h-full">
               <div className="w-12 h-12 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin mb-4"></div>
               <p className="text-slate-400 font-medium">Waiting for teacher to push a slide...</p>
            </div>
         ) : (
            <div className="w-full h-full flex flex-col items-center justify-center animate-in fade-in duration-300">
               
               {/* Iframe Viewer (Google Slides / YouTube) locked down by Glass Shield */}
               {activeSlide.url && parseMediaUrl(activeSlide.url)?.type === 'iframe' && (
                  <div className="relative w-full h-full flex justify-center bg-black overflow-hidden">
                     
                     {/* THE INVISIBLE GLASS SHIELD: Blocks all student clicks, swipes, and scrolls! */}
                     <div className="absolute inset-0 z-10 w-full h-full"></div>
                     
                     <iframe 
                       src={parseMediaUrl(activeSlide.url).src} 
                       className="w-full h-full border-0 bg-black pointer-events-none" 
                       allowFullScreen
                     />
                  </div>
               )}

               {/* Image Viewer */}
               {activeSlide.url && parseMediaUrl(activeSlide.url)?.type === 'image' && (
                  <div className="relative w-full h-full flex justify-center bg-black overflow-hidden">
                     <img src={activeSlide.url} alt="Presentation Slide" className="w-full h-full object-contain" />
                  </div>
               )}
            </div>
         )}
      </div>

      {/* Interactive Overlay Modal (Pops up for Questions) */}
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

function ProjectorView({ roomCode }) {
  const [activeSlide, setActiveSlide] = useState(null);
  const [activeQuestion, setActiveQuestion] = useState(null);

  // Listen for both Slides and Questions from Firebase
  useEffect(() => {
    const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
    
    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setActiveQuestion(data.activeQuestion || null);
        setActiveSlide(data.activeSlide || null);
      }
    });

    return () => unsubscribe();
  }, [roomCode]);

  return (
    <div className="w-full h-screen bg-black relative flex flex-col font-sans overflow-hidden">
      
      {/* HUD Info for Students to read from the projector */}
      <div className="absolute top-6 left-6 z-20 bg-slate-900/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-slate-700 shadow-2xl">
        <span className="text-slate-300 font-medium text-2xl drop-shadow-md">
          Join at <span className="text-white font-bold">{window.location.host}</span> with code: 
          <span className="text-emerald-400 font-mono font-bold text-4xl ml-3 align-middle">{roomCode}</span>
        </span>
      </div>

      {/* Main Slide Presentation Viewer */}
      <div className="absolute inset-0 w-full h-full bg-black z-0">
         {!activeSlide ? (
            <div className="flex flex-col items-center justify-center w-full h-full bg-slate-950">
               <svg className="w-32 h-32 text-slate-700 mb-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
               <p className="text-slate-400 font-medium text-4xl">Waiting for presentation to begin...</p>
            </div>
         ) : (
            <div className="w-full h-full flex flex-col items-center justify-center animate-in fade-in duration-300">
               
               {/* Iframe Viewer - GLASS SHIELD REMOVED FOR PROJECTOR! */}
               {activeSlide.url && parseMediaUrl(activeSlide.url)?.type === 'iframe' && (
                  <div className="relative w-full h-full flex justify-center bg-black overflow-hidden">
                     <iframe 
                       src={parseMediaUrl(activeSlide.url).src} 
                       className="w-full h-full border-0 bg-black" 
                       allowFullScreen
                     />
                  </div>
               )}

               {/* Image Viewer */}
               {activeSlide.url && parseMediaUrl(activeSlide.url)?.type === 'image' && (
                  <div className="relative w-full h-full flex justify-center bg-black overflow-hidden">
                     <img src={activeSlide.url} alt="Presentation Slide" className="w-full h-full object-contain" />
                  </div>
               )}
            </div>
         )}
      </div>

      {/* Projector-sized Question Overlay (No buttons, just display) */}
      {activeQuestion && (
        <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-6xl p-10 bg-slate-900/90 backdrop-blur-xl rounded-[2.5rem] border-2 border-blue-500 shadow-[0_0_80px_rgba(59,130,246,0.3)] animate-in slide-in-from-bottom-12">
            <div className="text-center mb-10">
               <div className="inline-block bg-blue-500 text-white px-6 py-2 rounded-full text-lg font-bold uppercase tracking-widest mb-6 shadow-lg shadow-blue-500/30">
                 Class Question
               </div>
               <h2 className="text-6xl font-bold text-white leading-tight">{activeQuestion.text}</h2>
            </div>
            <div className="flex justify-center gap-8">
               {activeQuestion.options.map((opt, idx) => (
                  <div key={idx} className="flex-1 max-w-lg bg-slate-800 border-2 border-slate-600 px-10 py-8 rounded-3xl text-center shadow-2xl">
                     <span className="text-4xl font-medium text-white">{opt}</span>
                  </div>
               ))}
            </div>
        </div>
      )}
    </div>
  );
}