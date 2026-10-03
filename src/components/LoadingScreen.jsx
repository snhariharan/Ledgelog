import React from "react";

export default function LoadingScreen({ message = "Loading…" }) {
  return (
    <div className="loading-screen">
      <div className="loading-spinner"/>
      <div className="loading-msg">{message}</div>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}
