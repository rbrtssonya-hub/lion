// Contours are traced independently on each original 1254 × 1254 PNG.
// Eyes render beneath the brows; jaw contours stop below the fixed upper teeth.
export const frontFaceProfiles = {
  joy: {
    underpaintKey: 'expressionJoyUnderpaint',
    parts: [
      {
        name: 'eye-left', origin: '397px 516px', delay: 110,
        path: 'M283 362 C312 376 337 394 359 415 C382 437 403 454 413 477 C422 500 428 528 444 552 C417 572 387 584 351 590 C312 597 277 594 257 581 C242 571 243 548 250 519 C259 461 271 403 283 362 Z',
        peak: 'translate(2px, -2px) scale(1.025, .98)',
        relaxed: 'translate(1px, -1px) scale(1.012, .99)',
      },
      {
        name: 'eye-right', origin: '854px 519px', delay: 150,
        path: 'M949 368 C970 406 987 463 995 519 C1002 551 1007 581 992 596 C970 614 930 608 893 596 C858 585 827 568 803 548 C821 527 833 499 847 474 C871 437 910 393 949 368 Z',
        peak: 'translate(-2px, -2px) scale(1.025, .98)',
        relaxed: 'translate(-1px, -1px) scale(1.012, .99)',
      },
      {
        name: 'jaw', origin: '622px 924px', delay: 240,
        path: 'M396 892 C441 873 479 854 526 839 C556 830 575 825 599 826 C641 824 683 834 725 847 C773 861 813 879 842 902 C836 937 816 964 780 987 C737 1013 674 1029 613 1024 C528 1023 448 1004 415 964 C397 943 389 914 396 892 Z',
        peak: 'translateY(10px) scaleY(1.015)',
        relaxed: 'translateY(5px) scaleY(1.007)',
      },
      {
        name: 'brow-left', origin: '359px 335px', delay: 0,
        path: 'M174 333 C174 272 207 221 262 190 C312 163 370 170 416 193 C470 216 501 256 518 302 C541 355 531 415 505 465 C488 499 468 531 447 551 C436 533 429 505 416 475 C406 453 383 434 361 414 C338 394 310 374 283 360 C268 374 248 406 226 432 C204 425 186 390 178 359 Z',
        peak: 'translateY(-12px) rotate(-.6deg)',
        relaxed: 'translateY(-6px) rotate(-.3deg)',
      },
      {
        name: 'brow-right', origin: '905px 339px', delay: 25,
        path: 'M745 320 C765 268 804 223 858 202 C903 183 964 184 1003 201 C1045 225 1068 270 1071 314 C1074 357 1054 401 1027 424 C1007 431 1001 407 982 401 C967 390 956 371 949 368 C915 394 881 435 854 470 C835 500 824 528 812 551 C793 539 777 499 766 457 C746 417 735 356 745 320 Z',
        peak: 'translateY(-13px) rotate(.6deg)',
        relaxed: 'translateY(-6px) rotate(.3deg)',
      },
    ],
    foreground: [
      { cx: 507, cy: 279, r: 31 }, { cx: 740, cy: 281, r: 31 },
      { cx: 514, cy: 564, r: 62 }, { cx: 746, cy: 569, r: 63 },
      { cx: 629, cy: 625, r: 71 },
    ],
    timing: { peak: .12, hold: .4, relax: .56, second: .72, secondHold: .81 },
  },
  anger: {
    underpaintKey: 'expressionAngerUnderpaint',
    parts: [
      {
        name: 'eye-left', origin: '374px 554px', delay: 90,
        path: 'M270 435 C299 463 321 497 345 530 C369 562 395 597 426 628 C408 638 383 644 349 648 C310 653 278 649 253 633 C233 618 226 592 231 561 C240 508 255 463 270 435 Z',
        peak: 'translate(3px, 2px) scale(1.005, .94)',
        relaxed: 'translate(1px, 1px) scale(1.002, .97)',
      },
      {
        name: 'eye-right', origin: '874px 595px', delay: 90,
        path: 'M981 478 C1004 517 1019 565 1024 611 C1028 644 1022 673 1001 691 C978 710 938 709 899 700 C851 690 811 672 778 650 C811 645 844 617 873 586 C904 555 940 517 981 478 Z',
        peak: 'translate(-3px, 2px) scale(1.005, .94)',
        relaxed: 'translate(-1px, 1px) scale(1.002, .97)',
      },
      {
        name: 'jaw', origin: '607px 1026px', delay: 210,
        path: 'M385 965 C442 961 478 952 516 943 C543 935 557 922 577 923 C596 923 610 943 632 959 C676 985 727 997 780 1005 L827 1012 C813 1035 782 1062 744 1078 C707 1094 660 1102 610 1101 C547 1100 488 1083 446 1057 C411 1036 389 1004 385 965 Z',
        peak: 'translateY(-5px) scaleY(.985)',
        relaxed: 'translateY(-2px) scaleY(.993)',
      },
      {
        name: 'brow-left', origin: '340px 377px', delay: 0,
        path: 'M132 299 C117 263 138 216 177 190 C215 163 253 154 293 164 C347 174 395 209 432 252 C466 291 486 333 499 381 C513 430 502 483 480 535 C466 574 451 609 433 631 C414 610 398 587 379 562 C353 528 331 496 309 468 C293 448 279 438 270 435 C256 445 250 462 245 471 C227 477 210 458 190 426 C167 392 146 349 132 299 Z',
        peak: 'translate(4px, 9px) rotate(1.4deg)',
        relaxed: 'translate(2px, 5px) rotate(.7deg)',
      },
      {
        name: 'brow-right', origin: '939px 431px', delay: 0,
        path: 'M742 466 C741 403 768 345 814 297 C857 257 908 235 961 227 C1018 226 1102 223 1139 253 C1170 272 1181 311 1174 345 C1166 376 1147 398 1122 421 C1095 442 1073 441 1053 457 C1020 486 1001 488 981 478 C945 511 913 545 884 574 C853 606 822 636 791 652 C781 658 771 646 763 633 C753 607 748 581 742 547 C737 510 739 484 742 466 Z',
        peak: 'translate(-4px, 8px) rotate(-1.4deg)',
        relaxed: 'translate(-2px, 4px) rotate(-.7deg)',
      },
    ],
    foreground: [
      { cx: 500, cy: 309, r: 34 }, { cx: 780, cy: 333, r: 35 },
      { cx: 477, cy: 662, r: 64 }, { cx: 740, cy: 685, r: 65 },
      { cx: 596, cy: 737, r: 80 },
    ],
    timing: { peak: .09, hold: .43, relax: .59, second: .73, secondHold: .83 },
  },
  delight: {
    underpaintKey: 'expressionDelightUnderpaint',
    parts: [
      {
        name: 'eye-left', origin: '518px 422px', delay: 100,
        path: 'M417 309 C451 316 480 342 506 369 C534 397 553 419 574 432 C541 451 510 477 468 496 C425 512 383 521 358 510 C350 493 356 460 368 421 C384 367 399 329 417 309 Z',
        peak: 'translate(1px, -3px) scale(1.04, 1.04)',
        relaxed: 'translateY(-1px) scale(1.02, 1.02)',
      },
      {
        name: 'eye-right', origin: '940px 424px', delay: 135,
        path: 'M971 310 C1004 348 1022 403 1038 443 L1057 478 C1017 486 992 467 971 454 C941 449 913 445 892 430 C906 393 934 347 971 310 Z',
        peak: 'translate(-1px, -3px) scale(1.04, 1.04)',
        relaxed: 'translateY(-1px) scale(1.02, 1.02)',
      },
      {
        name: 'jaw', origin: '758px 764px', delay: 230,
        path: 'M541 713 C573 694 607 670 644 649 C684 626 723 611 762 608 C809 605 854 615 894 636 C922 652 939 669 949 687 C958 698 967 694 972 686 C982 713 983 740 981 763 C997 782 982 814 951 832 C915 853 859 865 799 866 C716 866 638 849 586 821 C553 806 532 787 520 768 C515 751 519 730 528 717 Z',
        peak: 'translateY(20px) scaleY(1.025)',
        relaxed: 'translateY(10px) scaleY(1.012)',
      },
      {
        name: 'brow-left', origin: '445px 284px', delay: 0,
        path: 'M226 359 C260 332 273 287 294 250 C319 215 352 184 395 168 C443 147 489 152 536 175 C581 198 609 234 627 280 C641 325 633 375 613 413 C599 432 585 440 574 432 C553 419 534 397 506 369 C480 342 451 316 417 309 C392 321 373 336 353 349 C314 366 280 376 244 378 Z',
        peak: 'translateY(-21px) rotate(-1deg)',
        relaxed: 'translateY(-10px) rotate(-.5deg)',
      },
      {
        name: 'brow-right', origin: '972px 278px', delay: 15,
        path: 'M838 278 C858 227 906 181 953 164 C1002 149 1039 162 1069 193 C1097 221 1108 254 1107 288 C1105 328 1092 358 1066 365 C1048 359 1035 342 1020 333 C1002 323 985 328 972 350 C958 375 946 396 928 411 C910 430 893 436 874 427 C853 414 837 386 831 351 C825 325 828 299 838 278 Z',
        peak: 'translateY(-20px) rotate(1deg)',
        relaxed: 'translateY(-10px) rotate(.5deg)',
      },
    ],
    foreground: [
      { cx: 584, cy: 168, r: 51 }, { cx: 824, cy: 207, r: 51 },
      { cx: 643, cy: 366, r: 60 }, { cx: 870, cy: 370, r: 55 },
      { cx: 773, cy: 395, r: 66 },
    ],
    foregroundPaths: [
      'M589 420 C610 410 647 412 673 426 C690 445 677 465 652 473 C626 483 596 481 577 470 C566 454 570 433 589 420 Z',
    ],
    timing: { peak: .1, hold: .38, relax: .53, second: .69, secondHold: .8 },
  },
};
