import React, { createContext, useState, useContext, useEffect } from 'react';

export const HealthContext = createContext();

export const HealthProvider = ({ children }) => {
  const [health, setHealth] = useState(5);
  const [maxHealth, setMaxHealth] = useState(5);

  const deduct = () => {
    setHealth(prev => Math.max(0, prev - 1));
  };

  const refreshHealth = (newHealth) => {
    setHealth(newHealth);
  };

  return (
    <HealthContext.Provider value={{ health, maxHealth, deduct, refreshHealth }}>
      {children}
    </HealthContext.Provider>
  );
};

export const useHealth = () => useContext(HealthContext);
