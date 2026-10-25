const parts = [
  { name: 'eye-left', origin: '431px 524px', delay: 120,
    path: 'M369 387 C333 417 308 465 296 517 C287 548 281 577 293 594 C309 614 350 612 390 603 L508 575 C521 563 522 541 511 518 C486 463 430 418 369 387 Z',
    peak: 'translateY(-2px) scale(1.035, 1.065)', relaxed: 'translateY(-1px) scale(1.018, 1.032)' },
  { name: 'eye-right', origin: '889px 524px', delay: 120,
    path: 'M948 386 C981 423 1002 474 1013 527 C1022 559 1029 584 1014 598 C997 615 958 610 918 599 L837 577 C823 568 822 548 831 525 C854 470 898 420 948 386 Z',
    peak: 'translateY(-2px) scale(1.035, 1.065)', relaxed: 'translateY(-1px) scale(1.018, 1.032)' },
  { name: 'jaw', origin: '673px 849px', delay: 240,
    path: 'M674 786 C624 786 581 796 545 817 C515 833 491 845 468 850 C453 859 447 874 449 890 C457 931 491 963 542 981 C579 994 621 999 669 999 C753 1000 833 978 876 929 C899 902 907 869 895 843 C870 838 841 828 808 812 C767 792 719 785 674 786 Z',
    peak: 'translateY(18px) scaleY(1.035)', relaxed: 'translateY(9px) scaleY(1.017)' },
  { name: 'brow-left', origin: '385px 330px', delay: 0,
    path: 'M190 368 C192 313 229 264 284 235 C342 203 406 199 463 219 C514 237 548 277 564 328 C582 389 572 450 543 493 L510 537 C492 520 479 493 460 467 C438 438 409 420 379 411 C347 400 327 409 310 434 L291 468 C267 477 239 465 220 443 C201 422 193 395 190 368 Z',
    peak: 'translateY(-22px) rotate(-1.2deg)', relaxed: 'translateY(-12px) rotate(-.6deg)' },
  { name: 'brow-right', origin: '938px 330px', delay: 0,
    path: 'M761 361 C764 308 799 269 847 244 C901 217 964 214 1020 230 C1075 246 1102 284 1105 334 C1108 379 1086 422 1054 452 C1038 467 1016 475 999 459 L975 423 C961 403 942 393 923 402 C892 418 863 445 843 477 L817 523 C794 513 778 485 771 451 C765 423 760 391 761 361 Z',
    peak: 'translateY(-24px) rotate(1.1deg)', relaxed: 'translateY(-13px) rotate(.55deg)' },
];

export const surpriseFaceProfile = {
  underpaintKey: 'expressionSurpriseUnderpaint',
  parts,
  foreground: [{ cx: 551, cy: 250, r: 50 }, { cx: 800, cy: 248, r: 54 },
    { cx: 563, cy: 530, r: 61 }, { cx: 783, cy: 529, r: 61 }, { cx: 672, cy: 573, r: 66 }],
};
