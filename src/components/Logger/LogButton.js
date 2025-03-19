import React from 'react';
import './LogButton.css';

const LogButton = ({ onClick }) => {
  return (
    <button className="log-button" onClick={onClick} title="查看操作日志">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        <circle cx="12" cy="8" r="1.5"></circle>
        <circle cx="12" cy="12" r="1.5"></circle>
        <circle cx="12" cy="16" r="1.5"></circle>
      </svg>
      日志
    </button>
  );
};

export default LogButton; 