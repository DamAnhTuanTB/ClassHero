export function getAssessmentResultEncouragement(scoreOnTen: number) {
  if (scoreOnTen === 10) {
    return {
      className: "text-amber-600 dark:text-amber-300",
      emoji: "🏆",
      message: "Quá đỉnh! Bạn đúng hết rồi!",
    };
  }

  if (scoreOnTen >= 8) {
    return {
      className: "text-emerald-600 dark:text-emerald-300",
      emoji: "🌟",
      message: "Tuyệt lắm! Bạn làm rất tốt!",
    };
  }

  if (scoreOnTen >= 6.5) {
    return {
      className: "text-sky-700 dark:text-sky-300",
      emoji: "👏",
      message: "Khá lắm! Cố thêm chút nữa nhé!",
    };
  }

  if (scoreOnTen >= 5) {
    return {
      className: "text-sky-700 dark:text-sky-300",
      emoji: "👍",
      message: "Ổn rồi! Xem lại vài câu nhé!",
    };
  }

  return {
    className: "text-rose-600 dark:text-rose-300",
    emoji: "💪",
    message: "Không sao đâu! Xem lại rồi thử lại nhé!",
  };
}
