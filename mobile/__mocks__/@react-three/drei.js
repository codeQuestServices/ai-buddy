// Mock for @react-three/drei
const useGLTF = Object.assign(
  jest.fn().mockReturnValue({
    scene: {
      traverse: jest.fn(),
      rotation: { x: 0, y: 0, z: 0 },
    },
  }),
  {
    preload: jest.fn(),
  }
);

module.exports = {
  useGLTF,
};
