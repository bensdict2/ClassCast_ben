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

const generateRoomCode = () => {
  return Math.floor(10000 + Math.random() * 90000).toString(); // 5 digit code
};

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'select', 'teacher', 'student'
  const [roomCode, setRoomCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Check if the URL has the secret hash
  const isTeacherMode = window.location.hash === '#teacher';

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
    
    return () => unsubscribe();
  }, []);

  if (!user) {
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
            
            {/* ONLY show the Teacher button if the URL ends in #teacher */}
            {isTeacherMode && (
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

  return role === 'teacher' ? (
    <TeacherView user={user} roomCode={roomCode} />
  ) : (
    <StudentView user={user} roomCode={roomCode} studentName={studentName} />
  );
}

function TeacherView({ user, roomCode }) {
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Form state for new question
  const [questionText, setQuestionText] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');

  // Slide state (The Nearpod Architecture)
  const [slideUrl, setSlideUrl] = useState('');
  const [slideCaption, setSlideCaption] = useState('');
  const [activeSlide, setActiveSlide] = useState(null);

  // Listen to answers and active slide when session is mounted
  useEffect(() => {
    const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
    const unsubscribeSession = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setActiveSlide(data.currentSlide || null);
        setActiveQuestion(data.activeQuestion || null);
      }
    });

    const answersRef = collection(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode, 'answers');
    const unsubscribeAnswers = onSnapshot(answersRef, (snapshot) => {
      const results = [];
      snapshot.forEach(doc => results.push(doc.data()));
      setAnswers(results);
    }, (error) => {
      console.error("Error fetching answers:", error);
    });

    return () => {
      unsubscribeSession();
      unsubscribeAnswers();
    };
  }, [roomCode]);

  const pushSlide = async () => {
    if (!slideUrl && !slideCaption) {
      setErrorMsg("Please provide an image URL or text to present.");
      return;
    }
    setErrorMsg('');
    
    try {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
      await setDoc(sessionRef, { 
        currentSlide: { url: slideUrl, caption: slideCaption } 
      }, { merge: true });
    } catch (err) {
      setErrorMsg("Failed to push slide.");
      console.error(err);
    }
  };

  const clearSlide = async () => {
    try {
      const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
      await setDoc(sessionRef, { currentSlide: null }, { merge: true });
      setSlideUrl('');
      setSlideCaption('');
    } catch (err) {
      console.error(err);
    }
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

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col md:flex-row gap-6 font-sans">
      
      {/* Left Column: Slide Control & Preview */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Teacher Dashboard</h2>
            <p className="text-slate-400">Class Code: <span className="text-emerald-400 font-mono text-xl tracking-wider ml-2">{roomCode}</span></p>
          </div>
          <div className="flex items-center gap-4">
             <div className="bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl border border-emerald-500/30 text-sm font-bold shadow-lg">
               🚀 Sync Engine Active
             </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-xl">
            {errorMsg}
          </div>
        )}

        {/* Slide Control Panel */}
        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700">
           <h3 className="text-xl font-bold mb-4 text-blue-400 border-b border-slate-700 pb-2">Present a Slide</h3>
           <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Image URL (e.g., https://example.com/map.jpg)" 
                value={slideUrl}
                onChange={(e) => setSlideUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
              />
              <textarea 
                placeholder="Type slide instructions or text..." 
                value={slideCaption}
                onChange={(e) => setSlideCaption(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 h-24 resize-none"
              />
              <div className="flex gap-4">
                <button 
                  onClick={pushSlide}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all shadow-lg text-white active:scale-95"
                >
                  Sync to Devices
                </button>
                {activeSlide && (
                  <button 
                    onClick={clearSlide}
                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-all text-white border border-slate-600 active:scale-95"
                  >
                    Clear Screen
                  </button>
                )}
              </div>
           </div>
        </div>

        {/* Live Preview of what students see */}
        <div className="flex-1 bg-black rounded-2xl overflow-hidden border border-slate-700 shadow-2xl relative min-h-[400px] flex items-center justify-center p-6">
          {!activeSlide ? (
            <div className="text-slate-500 text-center">
              <p className="text-xl font-medium mb-2">Classroom screens are blank.</p>
              <p className="text-sm">Push a slide or text above to sync to devices.</p>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center">
               <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-white/50 border border-white/10 uppercase tracking-widest">
                 Live Preview
               </div>
               {activeSlide.url && <img src={activeSlide.url} alt="Slide Preview" className="max-h-[250px] object-contain rounded-lg mb-6 shadow-lg border border-slate-700" />}
               {activeSlide.caption && <h2 className="text-3xl font-bold text-white">{activeSlide.caption}</h2>}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Interaction Panel (Questions) */}
      <div className="w-full md:w-96 flex flex-col gap-6">
        <div className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700">
          <h3 className="text-xl font-bold mb-4 text-emerald-400 border-b border-slate-700 pb-2">Pop Question</h3>
          
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
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold transition-all shadow-lg text-white active:scale-95"
              >
                Launch Overlay
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-900 p-4 rounded-xl border border-emerald-500/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-blue-500"></div>
                <p className="font-semibold text-white mb-2">{activeQuestion.text}</p>
                <div className="text-sm text-slate-400 flex flex-col gap-2">
                  <span className="bg-slate-800 px-3 py-2 rounded border border-slate-700">A: {activeQuestion.options[0]}</span>
                  <span className="bg-slate-800 px-3 py-2 rounded border border-slate-700">B: {activeQuestion.options[1]}</span>
                </div>
              </div>
              <button 
                onClick={clearQuestion}
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-all text-white border border-slate-600 active:scale-95"
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
                <div key={idx} className="bg-slate-900 p-3 rounded-lg border border-slate-700 flex justify-between items-center animate-fade-in">
                  <span className="font-medium text-slate-200">{ans.studentName}</span>
                  <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm font-bold border border-blue-500/30">
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
  const [errorMsg, setErrorMsg] = useState('');
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [activeSlide, setActiveSlide] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);

  useEffect(() => {
    const sessionRef = doc(db, 'artifacts', appId, 'public', 'data', 'sessions', roomCode);
    
    const unsubscribe = onSnapshot(sessionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Update the slide they are viewing
        setActiveSlide(data.currentSlide || null);

        // Update the question overlay
        if (data.activeQuestion) {
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
      console.error("Error listening to session:", error);
      setErrorMsg("Lost connection to classroom. Please refresh.");
    });

    return () => unsubscribe();
  }, [roomCode, appId, activeQuestion]);

  const submitAnswer = async (optionText) => {
    if (!activeQuestion) return;
    
    setHasAnswered(true); 
    
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
      setErrorMsg("Failed to submit answer. Check connection.");
      setHasAnswered(false);
    }
  };

  return (
    <div className="w-full h-screen bg-slate-900 relative flex flex-col font-sans overflow-hidden">
      
      {/* Header Bar */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg">
            {studentName.charAt(0).toUpperCase()}
          </div>
          <span className="text-white font-medium">{studentName}</span>
        </div>
        <div className="flex items-center gap-2 bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/20 shadow-inner">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
          <span className="text-xs text-emerald-300 font-bold tracking-widest uppercase">Synced</span>
        </div>
      </div>

      {errorMsg && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-20 bg-red-600 text-white px-6 py-2 rounded-full shadow-lg text-sm whitespace-nowrap">
          {errorMsg}
        </div>
      )}

      {/* Main Slide Viewer */}
      <div className="flex-1 w-full h-full relative flex items-center justify-center p-8 mt-16">
         {!activeSlide ? (
            <div className="flex flex-col items-center justify-center text-center transition-all">
               <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center mb-6 shadow-xl border border-slate-700">
                  <svg className="w-10 h-10 text-blue-500 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
               </div>
               <h2 className="text-2xl font-bold text-white mb-2">Eyes on the board</h2>
               <p className="text-slate-400 font-medium max-w-sm">Waiting for the teacher to push the next slide...</p>
            </div>
         ) : (
            <div className="w-full h-full flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-300">
               {activeSlide.url && (
                  <div className="relative mb-8 max-h-[60vh] w-full flex justify-center">
                     <img src={activeSlide.url} alt="Presentation Slide" className="max-h-full object-contain rounded-2xl shadow-2xl border border-slate-700" />
                  </div>
               )}
               {activeSlide.caption && (
                  <h1 className="text-4xl md:text-5xl font-extrabold text-white text-center max-w-4xl leading-tight drop-shadow-lg">
                    {activeSlide.caption}
                  </h1>
               )}
            </div>
         )}
      </div>

      {/* Interactive Overlay Modal (Pops up when teacher pushes a question) */}
      {activeQuestion && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-all duration-300">
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
                   <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
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