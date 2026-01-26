export const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export const formatTime = (sec: number) =>
  `${Math.floor(sec / 60)}:${sec % 60 < 10 ? '0' : ''}${sec % 60}`;