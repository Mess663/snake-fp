/* eslint-disable import/prefer-default-export */
export const getRandom = (n: number, m: number) => {
    const num = Math.floor(Math.random() * (m - n + 1) + n);
    return num;
};
