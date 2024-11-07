<?php
require $_SERVER['DOCUMENT_ROOT'].'/vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable($_SERVER['DOCUMENT_ROOT']);
$dotenv->load();

function verifySignature($secret, $header, $payload) {
    $parts = explode("=", $header);
    if (count($parts) !== 2 || $parts[0] !== 'sha256') {
        return false;
    }
    $sigHex = $parts[1];

    $sigBytes = hex2bin($sigHex);
    if ($sigBytes === false) {
        return false;
    }

    $keyBytes = $secret;
    $expectedSig = hash_hmac('sha256', $payload, $keyBytes, true);

    if (hash_equals($expectedSig, $sigBytes)) {
        return true;
    } else {
        return false;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $signatureHeader = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
    $payload = file_get_contents('php://input');
    $secret = $_ENV["SECRET"];
    $base_url = $_ENV["BASE_URL"];

    if (verifySignature($secret, $signatureHeader, $payload)) {
        $data = json_decode($payload, true);

        if (isset($data['commits']) && is_array($data['commits']) && count($data['commits']) > 0) {
            $commit = $data['commits'][0];
            $args = "";

            if (isset($commit['url']) && strpos($commit['url'], $base_url.'<REPO_NAME>') === 0) {
                $args = '--source="<source_folder>" --dest="<destination_folder>" --cpdir="<folder_in_source_to_copy_content>"';
            }

            $script_path = '/var/git_remote/deployer.sh';
            $command = "bash $script_path $args 2>&1";

            exec($command, $output, $return_var);

            if ($return_var !== 0) {
                http_response_code(500);
                echo 'An internal error occurred: ' . implode("\n", $output);
            } else {
                http_response_code(200);
                echo 'Success';
            }
        } else {
            http_response_code(200);
            echo "Ping";
        }
    } else {
        http_response_code(403);
        echo "Invalid Signature";
    }
} else {
    http_response_code(400);
    echo "Bad Request";
}