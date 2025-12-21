import { google, Auth } from "googleapis";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import { URL } from "url";
import open from "open";

const SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/contacts",
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/presentations",
];

const TOKEN_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || ".",
  ".google-mcp",
  "tokens.json"
);

const CREDENTIALS_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || ".",
  ".google-mcp",
  "credentials.json"
);

interface CredentialsFile {
  installed?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
  web?: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

export class GoogleOAuth {
  private oauth2Client: Auth.OAuth2Client | null = null;
  private isAuthenticated = false;

  constructor() {
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    const dir = path.dirname(TOKEN_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadCredentials(): CredentialsFile | null {
    try {
      if (fs.existsSync(CREDENTIALS_PATH)) {
        const content = fs.readFileSync(CREDENTIALS_PATH, "utf-8");
        return JSON.parse(content) as CredentialsFile;
      }
    } catch (error) {
      console.error("Error loading credentials:", error);
    }
    return null;
  }

  private saveTokens(tokens: Auth.Credentials): void {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  }

  private loadTokens(): Auth.Credentials | null {
    try {
      if (fs.existsSync(TOKEN_PATH)) {
        const content = fs.readFileSync(TOKEN_PATH, "utf-8");
        return JSON.parse(content) as Auth.Credentials;
      }
    } catch (error) {
      console.error("Error loading tokens:", error);
    }
    return null;
  }

  async initialize(): Promise<boolean> {
    const credentials = this.loadCredentials();

    if (!credentials) {
      console.error(
        `No credentials found. Please place your Google OAuth credentials at: ${CREDENTIALS_PATH}`
      );
      console.error(
        "You can download credentials from: https://console.cloud.google.com/apis/credentials"
      );
      return false;
    }

    const { client_id, client_secret, redirect_uris } =
      credentials.installed || credentials.web || {};

    if (!client_id || !client_secret) {
      console.error("Invalid credentials file format");
      return false;
    }

    this.oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris?.[0] || "http://localhost:3000/oauth2callback"
    );

    // Try to load existing tokens
    const tokens = this.loadTokens();
    if (tokens) {
      this.oauth2Client.setCredentials(tokens);

      // Check if token needs refresh
      if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
        try {
          const { credentials: newTokens } = await this.oauth2Client.refreshAccessToken();
          this.saveTokens(newTokens);
          this.oauth2Client.setCredentials(newTokens);
        } catch (error) {
          console.error("Error refreshing token:", error);
          return false;
        }
      }

      this.isAuthenticated = true;
      return true;
    }

    return false;
  }

  async authenticate(): Promise<boolean> {
    if (!this.oauth2Client) {
      const initialized = await this.initialize();
      if (!initialized && !this.oauth2Client) {
        return false;
      }
    }

    if (this.isAuthenticated) {
      return true;
    }

    return new Promise((resolve) => {
      const authUrl = this.oauth2Client!.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "consent",
      });

      // Create a temporary server to handle the OAuth callback
      const server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url!, `http://localhost:3000`);

          if (url.pathname === "/oauth2callback") {
            const code = url.searchParams.get("code");

            if (code) {
              const { tokens } = await this.oauth2Client!.getToken(code);
              this.oauth2Client!.setCredentials(tokens);
              this.saveTokens(tokens);
              this.isAuthenticated = true;

              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(`
                <html>
                  <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e;">
                    <div style="text-align: center; color: #eee;">
                      <h1 style="color: #4ade80;">✓ Authentication Successful!</h1>
                      <p>You can close this window and return to your application.</p>
                    </div>
                  </body>
                </html>
              `);

              server.close();
              resolve(true);
            } else {
              res.writeHead(400, { "Content-Type": "text/html" });
              res.end("<html><body><h1>Authentication Failed</h1><p>No code received</p></body></html>");
              server.close();
              resolve(false);
            }
          }
        } catch (error) {
          console.error("OAuth callback error:", error);
          res.writeHead(500, { "Content-Type": "text/html" });
          res.end("<html><body><h1>Authentication Error</h1></body></html>");
          server.close();
          resolve(false);
        }
      });

      server.listen(3000, () => {
        console.error("Opening browser for authentication...");
        console.error(`If browser doesn't open, visit: ${authUrl}`);
        open(authUrl);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        if (!this.isAuthenticated) {
          server.close();
          resolve(false);
        }
      }, 300000);
    });
  }

  async setAuthCode(code: string): Promise<boolean> {
    if (!this.oauth2Client) {
      await this.initialize();
    }

    if (!this.oauth2Client) {
      return false;
    }

    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      this.saveTokens(tokens);
      this.isAuthenticated = true;
      return true;
    } catch (error) {
      console.error("Error exchanging auth code:", error);
      return false;
    }
  }

  getClient(): Auth.OAuth2Client | null {
    return this.oauth2Client;
  }

  isReady(): boolean {
    return this.isAuthenticated && this.oauth2Client !== null;
  }

  getAuthUrl(): string | null {
    if (!this.oauth2Client) {
      return null;
    }

    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
      prompt: "consent",
    });
  }

  async logout(): Promise<void> {
    if (fs.existsSync(TOKEN_PATH)) {
      fs.unlinkSync(TOKEN_PATH);
    }
    this.isAuthenticated = false;
    if (this.oauth2Client) {
      this.oauth2Client.revokeCredentials();
    }
  }

  getCredentialsPath(): string {
    return CREDENTIALS_PATH;
  }

  getTokenPath(): string {
    return TOKEN_PATH;
  }
}

export const oauth = new GoogleOAuth();

