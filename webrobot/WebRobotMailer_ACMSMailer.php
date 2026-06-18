<?php
namespace WebRobot;

require_once __DIR__ . '/WebRobotMailer.php';
require_once __DIR__ . '/../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\OAuth;
use League\OAuth2\Client\Provider\Google;

class WebRobotMailer_ACMSMailer implements WebRobotMailer {
    private $mailer_config;

    /**
     * WebRobotMailer_ACMSMailer constructor.
     *
     * @param array $configData The main configuration data (unused by this mailer).
     * @throws \Exception If the mailer configuration file is missing or invalid.
     */
    public function __construct(array $configData) {
        $projectRoot = dirname(__DIR__);
        $mailerConfigFile = $projectRoot . '/etc/acms_mailer.json';
        if (!file_exists($mailerConfigFile)) {
            throw new \Exception("ACMS Mailer configuration file not found: {$mailerConfigFile}");
        }
        $this->mailer_config = json_decode(file_get_contents($mailerConfigFile), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception("Error decoding ACMS mailer configuration file: " . json_last_error_msg());
        }
    }

    public function send($to, $subject, $body, $from_email, $from_name) {
        $mail = new PHPMailer(true);

        try {
            $mail->isSMTP();
            $mail->SMTPDebug = 0; // Set to SMTP::DEBUG_SERVER for debugging
            $mail->Host = $this->mailer_config['host'];
            $mail->Port = $this->mailer_config['port'];
            $mail->SMTPSecure = $this->mailer_config['smtp_secure'];
            $mail->SMTPAuth = $this->mailer_config['smtp_auth'];
            $mail->AuthType = $this->mailer_config['auth_type'];

            $provider = new Google([
                'clientId' => $this->mailer_config['oauth_client_id'],
                'clientSecret' => $this->mailer_config['oauth_client_secret'],
            ]);

            $mail->setOauth(new OAuth([
                'provider' => $provider,
                'clientId' => $this->mailer_config['oauth_client_id'],
                'clientSecret' => $this->mailer_config['oauth_client_secret'],
                'refreshToken' => $this->mailer_config['oauth_refresh_token'],
                'userName' => $this->mailer_config['oauth_email'],
            ]));

            $mail->setFrom($this->mailer_config['from_email'], $this->mailer_config['from_name']);
            $mail->addReplyTo($from_email, $from_name);
            $mail->addAddress($to);
            $mail->Subject = $subject;
            $mail->CharSet = PHPMailer::CHARSET_UTF8;
            $mail->Body = $body;

            return $mail->send();
        } catch (\Exception $e) {
            error_log("ACMS Mailer Error: " . $mail->ErrorInfo);
            return false;
        }
    }

    public function sendContactForm($name, $from_email, $subject, $message) {
        // The 'to' address should be configured securely, not hardcoded if possible.
        // For this example, we'll use a placeholder.
        $to = 'contact@acms-australia.org';
        //$to = 'pwillia6@gmail.com'; 
        $full_subject = "ACMS Contact Form: " . $subject;
        
        $body = "You have received a new message from your website contact form.\\n\\n";
        $body .= "Here are the details:\\n";
        $body .= "Name: {$name}\\n";
        $body .= "Email: {$from_email}\\n";
        $body .= "Subject: {$subject}\\n";
        $body .= "Message:\\n{$message}\\n";

        // Use the generic send method to actually send the email.
        return $this->send($to, $full_subject, $body, $from_email, $name);
    }

}
?>
