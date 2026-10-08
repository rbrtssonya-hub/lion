import unittest
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'site/assets/live2d/source-v4'


class Live2DEyeLayerV4Tests(unittest.TestCase):
    REQUIRED = (
        'Background_Repair.png',
        'Lion_Head_Base.png',
        'Eye_L.png',
        'Eye_R.png',
        'Pupil_L.png',
        'Pupil_R.png',
        'Eyelid_L.png',
        'Eyelid_R.png',
    )

    def test_full_eye_layer_set_exists_on_cover_canvas(self):
        for filename in self.REQUIRED:
            with self.subTest(filename=filename):
                image = Image.open(SOURCE / filename).convert('RGBA')
                self.assertEqual(image.size, (2048, 1152))

    def test_head_base_has_no_pixels_in_eye_centers(self):
        base = Image.open(SOURCE / 'Lion_Head_Base.png').convert('RGBA')
        alpha = base.getchannel('A')
        for point in ((950, 370), (1310, 445)):
            self.assertEqual(alpha.getpixel(point), 0)

    def test_eye_and_pupil_layers_are_visible(self):
        for filename, point in (
            ('Eye_L.png', (950, 370)),
            ('Eye_R.png', (1310, 445)),
            ('Pupil_L.png', (970, 365)),
            ('Pupil_R.png', (1315, 445)),
            ('Eyelid_L.png', (950, 370)),
            ('Eyelid_R.png', (1310, 445)),
        ):
            with self.subTest(filename=filename):
                image = Image.open(SOURCE / filename).convert('RGBA')
                self.assertGreater(image.getchannel('A').getpixel(point), 200)


if __name__ == '__main__':
    unittest.main()
