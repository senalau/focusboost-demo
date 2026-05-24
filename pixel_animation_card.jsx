import React from "react";

function FloatingStars() {
  return (
    <>
      <div className="star black s1" />
      <div className="star white s2" />
      <div className="star black s3" />
      <div className="star white s4" />
    </>
  );
}

function Bubble({ text }) {
  return (
    <div className="bubble">
      <span>{text}</span>
    </div>
  );
}

function DeskScene() {
  return (
    <div className="scene scene-desk">
      <div className="monitor"><div className="monitorGlow" /></div>
      <div className="monitorNeck" />
      <div className="monitorBase" />
      <div className="chair" />
      <div className="paperStack"><div className="paperLine" /></div>

      <div className="deskHead">
        <div className="hair h1" />
        <div className="hair h2" />
        <div className="hair h3" />
        <div className="face" />
        <div className="eye e1" />
        <div className="eye e2" />
      </div>

      <div className="deskBody"><div className="bodyLine" /></div>
      <div className="arm leftArm typing1" />
      <div className="arm rightArm typing2" />
      <div className="keyboard" />
      <div className="deskTop" />
      <div className="deskFront">
        <div className="deskLeg dl1" />
        <div className="deskLeg dl2" />
      </div>
    </div>
  );
}

function GymScene() {
  return (
    <div className="scene scene-gym">
      <div className="gymFloor" />
      <div className="dumbbell">
        <div className="w1" />
        <div className="w2" />
        <div className="bar" />
        <div className="w3" />
        <div className="w4" />
      </div>

      <div className="gymHead">
        <div className="hair h1" />
        <div className="hair h2" />
        <div className="face" />
        <div className="eye e1" />
        <div className="eye e2" />
      </div>

      <div className="gymBody" />
      <div className="gymArm ga1" />
      <div className="gymArm ga2" />
      <div className="gymLeg gl1" />
      <div className="gymLeg gl2" />
    </div>
  );
}

function ReadScene() {
  return (
    <div className="scene scene-read">
      <div className="sofa seat" />
      <div className="sofa back" />
      <div className="sofa side" />

      <div className="readHead">
        <div className="hair h1" />
        <div className="hair h2" />
        <div className="face" />
        <div className="eye e1" />
        <div className="eye e2" />
      </div>

      <div className="readBody" />
      <div className="readLeg rl1" />
      <div className="readLeg rl2" />

      <div className="book">
        <div className="bookPage p1" />
        <div className="bookPage p2" />
        <div className="spine" />
      </div>
    </div>
  );
}

function PixelCard({ scene, text }) {
  return (
    <div className="cardShell">
      <div className="card">
        <div className="vignette" />
        <FloatingStars />
        {scene}
        <Bubble text={text} />
      </div>
    </div>
  );
}

export default function PixelAnimationCard() {
  return (
    <div className="page">
      <style>{`
        * { box-sizing: border-box; }

        .page {
          min-height: 100vh;
          width: 100%;
          background: #f5f5f2;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 32px;
          overflow: auto;
        }

        .row {
          display: flex;
          gap: 32px;
          justify-content: center;
          align-items: center;
          flex-wrap: wrap;
        }

        .cardShell {
          width: 336px;
          height: 336px;
          background: #fff;
          border-radius: 48px;
          padding: 15px;
          box-shadow: 0 14px 32px rgba(0,0,0,.10);
          image-rendering: pixelated;
          flex: 0 0 auto;
        }

        .card {
          position: relative;
          width: 306px;
          height: 306px;
          background: #fff05c;
          border: 5px solid #050505;
          border-radius: 30px;
          overflow: hidden;
        }

        .vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 54% 44%, rgba(255,255,255,.28), rgba(255,255,255,0) 48%);
          pointer-events: none;
        }

        .star {
          position: absolute;
          z-index: 2;
        }

        .star.black {
          width: 8px;
          height: 8px;
          background: #050505;
        }

        .star.white {
          width: 16px;
          height: 16px;
          background: #fff;
          border: 4px solid #050505;
        }

        .s1 { left: 29px; top: 138px; animation: driftA 3.8s ease-in-out infinite; }
        .s2 { left: 70px; top: 54px; animation: driftB 4.6s ease-in-out infinite; }
        .s3 { right: 48px; top: 48px; animation: driftB 4.1s ease-in-out infinite; }
        .s4 { right: 40px; top: 145px; animation: driftA 4.4s ease-in-out infinite; }

        .bubble {
          position: absolute;
          left: 50%;
          bottom: 20px;
          width: 248px;
          height: 38px;
          transform: translateX(-50%);
          border: 3px solid #050505;
          border-radius: 999px;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 8px;
          z-index: 20;
          animation: bubbleFloat 2.4s ease-in-out infinite;
        }

        .bubble span {
          width: 100%;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          font-size: 9px;
          line-height: 1;
          color: #050505;
        }

        .scene {
          position: absolute;
          left: 50%;
          top: 72px;
          width: 230px;
          height: 170px;
          transform: translateX(-50%);
          z-index: 5;
          animation: sceneFloat 2.8s ease-in-out infinite;
        }

        .hair, .face, .eye {
          position: absolute;
        }
        .face { background: #f9e1bf; }
        .eye { width: 5px; height: 13px; background: #050505; }

        .monitor {
          position: absolute;
          left: 0;
          top: 50px;
          width: 66px;
          height: 52px;
          background: #2d2d2d;
          border: 5px solid #050505;
        }

        .monitorGlow {
          position: absolute;
          inset: 7px;
          background: #fff;
          opacity: .18;
          animation: monitorGlow 1.8s ease-in-out infinite;
        }

        .monitorNeck {
          position: absolute;
          left: 25px;
          top: 95px;
          width: 27px;
          height: 32px;
          background: #222;
          border: 5px solid #050505;
        }

        .monitorBase {
          position: absolute;
          left: 17px;
          top: 125px;
          width: 45px;
          height: 7px;
          background: #050505;
        }

        .chair {
          position: absolute;
          left: 150px;
          top: 80px;
          width: 36px;
          height: 58px;
          background: #111;
          border: 5px solid #050505;
        }

        .paperStack {
          position: absolute;
          right: 0;
          top: 112px;
          width: 42px;
          height: 21px;
          background: #fff;
          border: 5px solid #050505;
        }

        .paperLine {
          position: absolute;
          left: -4px;
          top: 7px;
          width: 48px;
          height: 5px;
          background: #050505;
        }

        .deskHead {
          position: absolute;
          left: 98px;
          top: 0;
          width: 85px;
          height: 82px;
        }

        .deskHead .h1 { left: 12px; top: 0; width: 54px; height: 14px; background: #111; }
        .deskHead .h2 { left: 0; top: 10px; width: 74px; height: 20px; background: #111; }
        .deskHead .h3 { left: 0; top: 24px; width: 80px; height: 40px; background: #111; }
        .deskHead .face { left: 19px; top: 31px; width: 52px; height: 38px; }
        .deskHead .e1 { left: 31px; top: 49px; }
        .deskHead .e2 { left: 52px; top: 49px; }

        .deskBody {
          position: absolute;
          left: 112px;
          top: 88px;
          width: 68px;
          height: 45px;
          background: #fff;
          border: 5px solid #050505;
        }

        .bodyLine {
          position: absolute;
          left: 18px;
          top: 17px;
          width: 31px;
          height: 5px;
          background: #050505;
          transform: rotate(-35deg);
          transform-origin: left center;
        }

        .arm {
          position: absolute;
          background: #f9e1bf;
          z-index: 7;
        }

        .leftArm {
          left: 96px;
          top: 116px;
          width: 22px;
          height: 15px;
          border-left: 5px solid #050505;
          border-bottom: 5px solid #050505;
        }

        .rightArm {
          left: 147px;
          top: 118px;
          width: 18px;
          height: 14px;
          border-right: 5px solid #050505;
          border-bottom: 5px solid #050505;
        }

        .typing1 { animation: tapA .95s steps(2,end) infinite; }
        .typing2 { animation: tapA 1.05s steps(2,end) infinite; }

        .keyboard {
          position: absolute;
          left: 119px;
          top: 128px;
          width: 39px;
          height: 7px;
          background: #050505;
          z-index: 6;
        }

        .deskTop {
          position: absolute;
          left: -10px;
          top: 133px;
          width: 250px;
          height: 20px;
          background: #6b4027;
          border: 5px solid #050505;
          z-index: 8;
        }

        .deskFront {
          position: absolute;
          left: 0;
          top: 153px;
          width: 230px;
          height: 26px;
          background: #4b2b1c;
          border-left: 5px solid #050505;
          border-right: 5px solid #050505;
          border-bottom: 5px solid #050505;
          z-index: 7;
        }

        .deskLeg {
          position: absolute;
          top: 6px;
          width: 7px;
          height: 15px;
          background: #050505;
        }

        .dl1 { left: 17px; }
        .dl2 { right: 17px; }

        .gymFloor {
          position: absolute;
          left: 36px;
          top: 138px;
          width: 158px;
          height: 7px;
          background: #050505;
        }

        .dumbbell {
          position: absolute;
          left: 88px;
          top: 62px;
          width: 56px;
          height: 16px;
          animation: liftBar 1.3s ease-in-out infinite;
        }

        .dumbbell > div {
          position: absolute;
          background: #050505;
        }

        .dumbbell .w1 { left: 0; top: 3px; width: 7px; height: 10px; }
        .dumbbell .w2 { left: 9px; top: 0; width: 8px; height: 16px; }
        .dumbbell .bar { left: 17px; top: 6px; width: 22px; height: 4px; }
        .dumbbell .w3 { right: 9px; top: 0; width: 8px; height: 16px; }
        .dumbbell .w4 { right: 0; top: 3px; width: 7px; height: 10px; }

        .gymHead {
          position: absolute;
          left: 86px;
          top: 12px;
          width: 60px;
          height: 52px;
        }

        .gymHead .h1 { left: 7px; top: 0; width: 43px; height: 12px; background: #111; }
        .gymHead .h2 { left: 0; top: 9px; width: 52px; height: 18px; background: #111; }
        .gymHead .face { left: 8px; top: 20px; width: 42px; height: 28px; }
        .gymHead .e1 { left: 20px; top: 32px; }
        .gymHead .e2 { left: 36px; top: 32px; }

        .gymBody {
          position: absolute;
          left: 96px;
          top: 74px;
          width: 42px;
          height: 52px;
          background: #5f86ff;
          border: 5px solid #050505;
        }

        .gymArm {
          position: absolute;
          top: 84px;
          width: 20px;
          height: 16px;
          background: #f9e1bf;
        }

        .ga1 {
          left: 79px;
          border-left: 5px solid #050505;
          border-bottom: 5px solid #050505;
        }

        .ga2 {
          left: 134px;
          border-right: 5px solid #050505;
          border-bottom: 5px solid #050505;
        }

        .gymLeg {
          position: absolute;
          top: 120px;
          width: 14px;
          height: 24px;
          background: #222;
        }

        .gl1 {
          left: 101px;
          border-left: 5px solid #050505;
          border-bottom: 5px solid #050505;
        }

        .gl2 {
          left: 128px;
          border-right: 5px solid #050505;
          border-bottom: 5px solid #050505;
        }

        .sofa {
          position: absolute;
          background: #d68b52;
          border: 5px solid #050505;
        }

        .seat { left: 60px; top: 111px; width: 112px; height: 38px; }
        .back { left: 72px; top: 94px; width: 37px; height: 27px; }
        .side { left: 145px; top: 94px; width: 28px; height: 48px; }

        .readHead {
          position: absolute;
          left: 83px;
          top: 20px;
          width: 70px;
          height: 58px;
        }

        .readHead .h1 { left: 9px; top: 0; width: 50px; height: 14px; background: #111; }
        .readHead .h2 { left: 2px; top: 10px; width: 58px; height: 20px; background: #111; }
        .readHead .face { left: 13px; top: 24px; width: 45px; height: 30px; }
        .readHead .e1 { left: 27px; top: 37px; }
        .readHead .e2 { left: 43px; top: 37px; }

        .readBody {
          position: absolute;
          left: 91px;
          top: 82px;
          width: 58px;
          height: 44px;
          background: #f28cb4;
          border: 5px solid #050505;
        }

        .readLeg {
          position: absolute;
          top: 124px;
          height: 18px;
          background: #4e6ddf;
        }

        .rl1 {
          left: 91px;
          width: 26px;
          border-left: 5px solid #050505;
          border-bottom: 5px solid #050505;
        }

        .rl2 {
          left: 120px;
          width: 29px;
          border-right: 5px solid #050505;
          border-bottom: 5px solid #050505;
        }

        .book {
          position: absolute;
          left: 92px;
          top: 96px;
          width: 52px;
          height: 32px;
          z-index: 8;
          animation: bookTilt 1.8s ease-in-out infinite;
          transform-origin: center center;
        }

        .bookPage {
          position: absolute;
          top: 0;
          width: 25px;
          height: 32px;
          background: #fff;
          border: 4px solid #050505;
        }

        .p1 { left: 0; }
        .p2 { right: 0; }

        .spine {
          position: absolute;
          left: 24px;
          top: 0;
          width: 4px;
          height: 32px;
          background: #050505;
        }

        @keyframes sceneFloat {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-6px); }
        }

        @keyframes driftA {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(4px, -4px); }
        }

        @keyframes driftB {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-4px, 4px); }
        }

        @keyframes bubbleFloat {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-3px); }
        }

        @keyframes tapA {
          0%, 48%, 100% { transform: translateY(0); }
          52%, 62% { transform: translateY(2px); }
        }

        @keyframes monitorGlow {
          0%, 100% { opacity: .18; }
          50% { opacity: .34; }
        }

        @keyframes liftBar {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @keyframes bookTilt {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-3deg); }
        }

        @media (max-width: 760px) {
          .page {
            align-items: flex-start;
          }
        }
      `}</style>

      <div className="row">
        <PixelCard scene={<DeskScene />} text="¥182 rewards · Mia正在努力「写引言」" />
        <PixelCard scene={<GymScene />} text="¥96 rewards · Leo正在健身「力量训练」" />
        <PixelCard scene={<ReadScene />} text="¥128 rewards · Nana正在读书「晚间阅读」" />
      </div>
    </div>
  );
}
