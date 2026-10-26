import { frontFaceProfiles } from './front.js';
import { posedFaceProfiles } from './poses.js';
import { surpriseFaceProfile } from './surprise.js';

export const faceProfiles = { ...frontFaceProfiles, ...posedFaceProfiles, surprise: surpriseFaceProfile };
