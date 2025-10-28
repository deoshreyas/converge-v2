import { atom } from 'nanostores';

export const dialogue = {
  root: {
    text: 'Welcome to the adventure! Do you want to go left or right?',
    options: [
      { text: 'Go Left', nextNode: 'leftPath' },
      { text: 'Go Right', nextNode: 'rightPath' },
    ],
  },
  leftPath: {
    text: 'You encounter a friendly dragon! What do you do?',
    options: [
      { text: 'Befriend the dragon', nextNode: 'befriendDragon' },
      { text: 'Run away', nextNode: 'runAway' },
    ],
  },
  rightPath: {
    text: 'You find a treasure chest! Do you want to open it?',
    options: [
      { text: 'Open the chest', nextNode: 'openChest' },
      { text: 'Leave it alone', nextNode: 'leaveChest' },
    ],
  },
  befriendDragon: {
    text: 'The dragon becomes your ally! You win!',
    options: [],
  },
  runAway: {
    text: 'You safely return home. The end.',
    options: [],
  },
  openChest: {
    text: 'The chest is filled with gold! You are rich!',
    options: [],
  },
  leaveChest: {
    text: 'You walk away, wondering what was inside. The end.',
    options: [],
  },
}

export const dialogueTree = atom({
  currentNode: 'root',
  history: [],
});
