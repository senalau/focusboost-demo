import { useCallback, useEffect, useRef, useState } from "react";

export function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSpeechSupported() {
  return Boolean(getSpeechRecognitionCtor());
}

/**
 * 浏览器 Web Speech API 语音转文字（Chrome / Edge / Safari 等）
 */
export function useSpeechInput({ onFinalText, onInterimText, lang = "zh-CN" } = {}) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef(null);
  const callbacksRef = useRef({ onFinalText, onInterimText });

  callbacksRef.current = { onFinalText, onInterimText };

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setError("当前浏览器不支持语音输入，请改用键盘输入");
      return;
    }

    stop();

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalChunk += transcript;
        else interim += transcript;
      }
      if (interim.trim()) callbacksRef.current.onInterimText?.(interim.trim());
      if (finalChunk.trim()) callbacksRef.current.onFinalText?.(finalChunk.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") {
        setListening(false);
        return;
      }
      const messages = {
        "not-allowed": "请允许麦克风权限后再试",
        "service-not-allowed": "语音服务不可用，请检查浏览器设置",
        network: "网络异常，语音识别失败",
      };
      setError(messages[event.error] || `语音识别失败（${event.error}）`);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setError("");
      setListening(true);
    } catch (err) {
      setError(err.message || "无法启动语音识别");
      setListening(false);
    }
  }, [lang, stop]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => () => stop(), [stop]);

  return {
    listening,
    error,
    supported: isSpeechSupported(),
    start,
    stop,
    toggle,
  };
}

export function appendSpeechText(previous, chunk) {
  const next = chunk.trim();
  if (!next) return previous;
  if (!previous.trim()) return next;
  const needsSep = !/[，,、；;。\s]$/.test(previous);
  return needsSep ? `${previous}，${next}` : `${previous}${next}`;
}
