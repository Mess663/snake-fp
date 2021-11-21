import './style/reset.less';
import './style.less';

import * as RF from 'ramda-fantasy';
import {
    clone, forEach, last, map, pipe, range, values,
} from 'ramda';
import { getRandom } from './tools';
import { KeyBoardCode } from './difinition';

type Position = [number, number]

const BLOCK_SIZE = 20;
const INIT_BLOCK_NUM = 6;
const APPLE_CLASS = 'apple';
const BLOCK_CLASS = 'snake-block';
const MOVE_SPEED = 100;
const VerticalCode = [KeyBoardCode.up, KeyBoardCode.down];
const HorizonalCode = [KeyBoardCode.left, KeyBoardCode.right];

const createSnakeBlock = (): HTMLDivElement => {
    const $div = document.createElement('div');
    $div.classList.add(BLOCK_CLASS);
    return $div;
};

const createApple = () => {
    const $div = document.createElement('div');
    $div.classList.add(APPLE_CLASS);
    return $div;
};

const moveDom = (x: number, y: number, dom: HTMLDivElement): HTMLDivElement => {
    dom.style.top = `${y * BLOCK_SIZE}px`;
    dom.style.left = `${x * BLOCK_SIZE}px`;
    return dom;
};

const initDom = (x: number, y: number, dom: HTMLDivElement) => moveDom(x, y, dom);

const initSnake = (gameDom: HTMLDivElement | null) => RF.IO(() => {
    if (!gameDom) return 0;

    const blocks = pipe(
        range(0),
        map((i) => RF.IO(() => initDom(0, i, createSnakeBlock()))),
        forEach((io) => gameDom.appendChild(io.runIO())),
    )(INIT_BLOCK_NUM);

    return blocks.length;
});

const initAppleIO = (gameDom: HTMLDivElement | null) => RF.IO((): Position => {
    if (!gameDom) return [0, 0];

    const x = getRandom(0, gameDom.offsetWidth / BLOCK_SIZE);
    const y = getRandom(0, gameDom.offsetHeight / BLOCK_SIZE);

    const $apple = initDom(x, y, createApple());

    gameDom.appendChild($apple);

    return [x, y];
});

const handlePosFromDirection = (x: number, y: number, direct: KeyBoardCode): Position => {
    if (direct === KeyBoardCode.down) return [x, y + 1];
    if (direct === KeyBoardCode.up) return [x, y - 1];
    if (direct === KeyBoardCode.left) return [x - 1, y];
    if (direct === KeyBoardCode.right) return [x + 1, y];
    return [x, y];
};

const autoMoveIO = (direct: KeyBoardCode, posArr: Position[]) => RF.IO(() => {
    const retPosArr = clone(posArr);
    document.querySelectorAll<HTMLDivElement>(`.${BLOCK_CLASS}`).forEach((d, i) => {
        const trackIndex = posArr.length - i;
        const pos = posArr[trackIndex];
        if (pos) {
            moveDom(...pos, d);
        } else {
            const newPos = handlePosFromDirection(...posArr[trackIndex - 1], direct);
            moveDom(...newPos, d);
            retPosArr.push(newPos);
        }
    });
    return retPosArr;
});

const addSnakeTailIO = (snakePosArr: Position[], gameDom: HTMLDivElement) => RF.IO(() => {
    const snakeLength = gameDom.querySelectorAll<HTMLDivElement>(`.${BLOCK_CLASS}`).length;
    const tailPos = snakePosArr[snakePosArr.length - snakeLength];
    const tail = initDom(...tailPos, createSnakeBlock());
    gameDom.appendChild(tail);
});

const clearAppleIO = (gameDom: HTMLDivElement) => RF.IO(() => {
    gameDom.querySelectorAll(`.${APPLE_CLASS}`).forEach((o) => o.remove());
});

const hasSameCode = (arr1: unknown[], arr2: unknown[]) => arr2.every((o) => arr1.includes(o));
const isSamePos = (pos1: Position, pos2: Position) => pos1[0] === pos2[0] && pos1[1] === pos2[1];

const initGameIO = (gameDom: HTMLDivElement) => RF.IO(() => {
    const len = initSnake(gameDom).runIO();
    const snakePosArr = range(0, len).map<Position>((i) => [0, i]);
    const appleCreator = initAppleIO(gameDom);

    let timer: number;
    let lastKeyCode: number;
    let blocksPosArr: Position[] = snakePosArr; // 蛇的位置
    let applePos = appleCreator.runIO();

    blocksPosArr = autoMoveIO(KeyBoardCode.down, blocksPosArr).runIO();

    window.addEventListener('keydown', (e: any) => {
        if (!values(KeyBoardCode).includes(e.code)) return;
        if (lastKeyCode === e.code) return;
        const codes = [lastKeyCode, e.code];
        if (hasSameCode(VerticalCode, codes) || hasSameCode(HorizonalCode, codes)) return;

        lastKeyCode = e.code;

        clearInterval(timer);
        timer = setInterval(() => {
            blocksPosArr = autoMoveIO(e.code, blocksPosArr).runIO();

            const headPos = last(blocksPosArr);
            if (headPos && isSamePos(headPos, applePos)) {
                clearAppleIO(gameDom).runIO();
                addSnakeTailIO(blocksPosArr, gameDom).runIO();
                applePos = appleCreator.runIO();
            }
        }, MOVE_SPEED);
    });
});

const __main = () => {
    const $game = document.querySelector<HTMLDivElement>('.game');

    if (!$game) return;

    initGameIO($game).runIO();
};

__main();
