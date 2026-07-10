export const gradeOptions = Array.from({ length: 10 }, (_, index) => {
  const grade = String(index + 3);

  return { value: grade, label: `Lớp ${grade}` };
});

export const genderOptions = [
  { value: "MALE", label: "Nam" },
  { value: "FEMALE", label: "Nữ" },
  { value: "OTHER", label: "Khác" },
];

const currentYear = new Date().getFullYear();

export const birthYearOptions = Array.from({ length: 11 }, (_, index) => {
  const year = String(currentYear - 8 - index);

  return { value: year, label: year };
});
