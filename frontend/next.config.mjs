/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
    domains: ['upload.wikimedia.org', 'platform-lookaside.fbsbx.com', "res.cloudinary.com",
      "yt3.ggpht.com",'pbs.twimg.com', "files.mastodon.social",
      "instagram.com","scontent.fbkk2-8.fna.fbcdn.net",'scontent.fbkk22-1.fna.fbcdn.net','graph.facebook.com', 'localhost', "lh3.googleusercontent.com","scontent.fbkk18-2.fna.fbcdn.net", 'api.telegram.org'],
  },
};

export default nextConfig;
