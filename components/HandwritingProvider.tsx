import React, { createContext, useState, useContext, useEffect, useRef, useCallback, ReactNode } from 'react';

// This is a global type definition for the experimental Handwriting API
declare global {
  interface Navigator {
    handwriting?: {
      createRecognizer: (options: { languages: string[] }) => Promise<HandwritingRecognizer>;
    };
  }
  interface HandwritingRecognizer {
    startDrawing: (options?: { ink: any }) => void;
    addPoint: (point: { x: number; y: number; t: number }) => void;
    finish: () => Promise<Array<{ text: string }>>;
  }
}

interface HandwritingContextType {
  isEnabled: boolean;
  isSupported: boolean;
  toggleHandwriting: () => void;
}

const HandwritingContext = createContext<HandwritingContextType | null>(null);

export const useHandwriting = () => {
  const context = useContext(HandwritingContext);
  if (!context) {
    throw new Error('useHandwriting must be used within a HandwritingProvider');
  }
  return context;
};

// A helper function to programmatically set the value of an input and trigger a React update
function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

  if (valueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter?.call(element, value);
  } else {
    valueSetter?.call(element, value);
  }

  // Dispatch an event to notify React of the change
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

export const HandwritingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  
  const recognizerRef = useRef<HandwritingRecognizer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentTargetRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const isDrawingRef = useRef(false);
  const strokePointsRef = useRef<{ x: number, y: number }[]>([]);

  useEffect(() => {
    console.log("Checking for Handwriting API support...");
    if (navigator.handwriting) {
      console.log("Handwriting API found. Attempting to create recognizer...");
      setIsSupported(true); // Optimistically set to true
      navigator.handwriting.createRecognizer({ languages: ['fa', 'en'] })
        .then(recognizer => {
          console.log("Handwriting recognizer created successfully.");
          recognizerRef.current = recognizer;
        })
        .catch(err => {
          console.error("Failed to create handwriting recognizer:", err);
          console.log("Handwriting API was found, but recognizer creation failed. Disabling feature.");
          setIsSupported(false); // Revert on failure
        });
    } else {
      console.warn("Web Handwriting API not supported in this browser. To enable on Chrome, go to chrome://flags and enable #enable-experimental-web-platform-features, then relaunch.");
      setIsSupported(false);
    }
  }, []);

  const toggleHandwriting = useCallback(() => {
    if (isSupported) {
      setIsEnabled(prev => !prev);
    } else {
      alert(
        'حالت نوشتاری در مرورگر شما پشتیبانی نمی‌شود یا فعال نیست.\n\n' +
        'این یک ویژگی آزمایشی است. در مرورگر کروم، می‌توانید با مراجعه به آدرس chrome://flags و فعال کردن گزینه #enable-experimental-web-platform-features آن را امتحان کنید.'
      );
    }
  }, [isSupported]);
  
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Hide canvas temporarily to find the element underneath
    canvas.style.pointerEvents = 'none';
    const underlyingElement = document.elementFromPoint(e.clientX, e.clientY);
    canvas.style.pointerEvents = 'auto';

    if (underlyingElement && (underlyingElement.tagName === 'INPUT' || underlyingElement.tagName === 'TEXTAREA')) {
        currentTargetRef.current = underlyingElement as HTMLInputElement | HTMLTextAreaElement;
        
        const ctx = canvas.getContext('2d')!;
        ctx.beginPath();
        ctx.moveTo(x, y);
        
        strokePointsRef.current = [{x, y}];
        recognizerRef.current?.startDrawing();
        recognizerRef.current?.addPoint({ x, y, t: Date.now() });

    } else {
        currentTargetRef.current = null;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentTargetRef.current) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d')!;
    ctx.lineTo(x, y);
    ctx.stroke();

    strokePointsRef.current.push({x, y});
    recognizerRef.current?.addPoint({ x, y, t: Date.now() });
  };

  const handlePointerUp = async () => {
    if (!isDrawingRef.current || !currentTargetRef.current) return;
    isDrawingRef.current = false;

    const startPoint = strokePointsRef.current[0];
    const endPoint = strokePointsRef.current[strokePointsRef.current.length - 1];
    
    // Gesture detection: Swipe right to clear
    const swipeDistance = endPoint.x - startPoint.x;
    const verticalMvmt = Math.abs(endPoint.y - startPoint.y);
    const isSwipe = swipeDistance > 100 && verticalMvmt < 50;

    if (isSwipe) {
        setNativeValue(currentTargetRef.current, '');
    } else {
        const predictions = await recognizerRef.current?.finish();
        if (predictions && predictions.length > 0) {
            const currentText = currentTargetRef.current.value;
            const newText = predictions[0].text;
            // Append with a space if there's already text
            const textToSet = currentText ? `${currentText} ${newText}` : newText;
            setNativeValue(currentTargetRef.current, textToSet);
        }
    }
    
    clearCanvas();
    currentTargetRef.current = null;
    strokePointsRef.current = [];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (isEnabled && canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#60a5fa'; // A light blue color
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [isEnabled]);


  return (
    <HandwritingContext.Provider value={{ isEnabled, isSupported, toggleHandwriting }}>
      {children}
      {isEnabled && isSupported && (
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp} // End drawing if pointer leaves canvas
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 1000, // High z-index to be on top of everything
            touchAction: 'none', // Prevents scrolling on touch devices while drawing
          }}
        />
      )}
    </HandwritingContext.Provider>
  );
};