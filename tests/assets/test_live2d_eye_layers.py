import unittest
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'source/live2d/source-v2'


class EyeLayerTests(unittest.TestCase):
    def test_closed_layers_cover_the_original_eye_centers(self):
        for name, point in [('EyeClosed_L', (960, 367)), ('EyeClosed_R', (1305, 452))]:
            with self.subTest(name=name):
                layer = Image.open(SOURCE / f'{name}.png').convert('RGBA')
                self.assertEqual(layer.size, (2048, 1152))
                self.assertGreater(layer.getchannel('A').getpixel(point), 245)

    def test_closed_layers_leave_brows_and_ornaments_untouched(self):
        for name, point in [('EyeClosed_L', (945, 250)), ('EyeClosed_R', (1340, 300))]:
            with self.subTest(name=name):
                layer = Image.open(SOURCE / f'{name}.png').convert('RGBA')
                self.assertEqual(layer.getchannel('A').getpixel(point), 0)

    def test_closed_layers_are_nonempty_over_the_eye_regions(self):
        for name in ('EyeClosed_L', 'EyeClosed_R'):
            with self.subTest(name=name):
                layer = Image.open(SOURCE / f'{name}.png').convert('RGBA')
                self.assertIsNotNone(layer.getchannel('A').getbbox())


if __name__ == '__main__':
    unittest.main()
